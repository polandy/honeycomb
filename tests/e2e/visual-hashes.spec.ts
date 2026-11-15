// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, requestToken, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const HASH = /^[0-9a-f]{16}$/

/** The entries of the admin's folder, as the cull lists them. */
async function listed(page: Page, folder: string): Promise<{ fileId: number, etag: string, visualHash: string | null }[]> {
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers: { requesttoken: await requestToken(page) } })
	expect(listing.status(), await listing.text()).toBe(200)
	return (await listing.json() as { entries: { fileId: number, etag: string, visualHash: string | null }[] }).entries
}

// spec: SERIES-003.1, SERIES-003.3, SERIES-003.12
test('stores the hashes the browser computed and lists them with the folder', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Hashes ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const first = await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	const second = await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:10'))
	// the client saves whatever it has hashed when its queue runs empty, so the two hashes may take one PUT or two
	const savedIds = new Set<number>()
	const allSaved = new Promise<void>((resolve) => {
		page.on('response', (response) => {
			if (!response.url().endsWith('/api/v1/visual-hashes') || response.request().method() !== 'PUT') {
				return
			}
			void response.json().then((body: { saved: number[] }) => {
				body.saved.forEach((id) => savedIds.add(id))
				if (savedIds.has(first) && savedIds.has(second)) {
					resolve()
				}
			})
		})
	})

	await cullFolder(page, folder)

	await allSaved
	const entries = await listed(page, folder)
	expect(entries.map((entry) => entry.fileId)).toEqual([first, second])
	entries.forEach((entry) => expect(entry.visualHash).toMatch(HASH))
})

// spec: SERIES-003.2, SERIES-003.5
test('skips a hash of an older version and lists a changed file without one', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Hashes ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileId = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	const entry = async () => (await listed(page, folder))[0]!
	const save = async (etag: string) => page.request.put(`${API}/visual-hashes`, {
		data: { hashes: [{ fileId, etag, hash: '00ff00ff00ff00ff' }] },
		headers: { requesttoken: await requestToken(page) },
	})

	expect(await (await save('an-older-etag')).json()).toEqual({ saved: [] })
	expect(await (await save((await entry()).etag)).json()).toEqual({ saved: [fileId] })
	expect((await entry()).visualHash).toBe('00ff00ff00ff00ff')
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))

	expect((await entry()).visualHash).toBeNull()
})
