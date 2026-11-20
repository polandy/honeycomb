// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const RECENT_LIMIT = 20

/** Sends `data` as JSON with the session's CSRF token. */
async function send(page: Page, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) {
	return page.request.fetch(`${API}${path}`, { method, data, headers: await apiHeaders(page) })
}

/** The flag fields of the folder's entries by file id, as the listing carries them. */
async function flagsOf(page: Page, folder: string) {
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers: await apiHeaders(page) })
	expect(listing.status(), await listing.text()).toBe(200)
	const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null, keepRaw: boolean | null, flagUpdated: number | null }[] }
	return new Map(entries.map(({ fileId, flag, keepRaw, flagUpdated }) => [fileId, { flag, keepRaw, updated: flagUpdated !== null }]))
}

// spec: DECISIONS-001.21, DECISIONS-001.23, DECISIONS-001.24, DECISIONS-001.27
test('stores whole flag states, lists them with the folder and takes over only missing rows', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Flags ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const [first, second] = [await upload(page, `${folder}/A.JPG`, JPEG), await upload(page, `${folder}/B.JPG`, JPEG)]

	const saved = await send(page, 'PUT', '/flags', { flags: [{ fileId: first, flag: 'picked', keepRaw: true }, { fileId: 900_001, flag: 'rejected', keepRaw: false }] })
	expect(saved.status(), await saved.text()).toBe(200)
	expect(await saved.json()).toEqual({ saved: [first], skipped: [{ fileId: 900_001, reason: 'notFound' }] })
	expect(await flagsOf(page, folder)).toEqual(new Map([[first, { flag: 'picked', keepRaw: true, updated: true }], [second, { flag: null, keepRaw: null, updated: false }]]))

	const takenOver = await send(page, 'POST', '/flags/take-over', { flags: [{ fileId: first, flag: 'rejected', keepRaw: false }, { fileId: second, flag: 'rejected', keepRaw: false }] })
	expect(await takenOver.json()).toEqual({ saved: [second], skipped: [{ fileId: first, reason: 'exists' }] })

	expect((await send(page, 'PUT', '/flags', { flags: [{ fileId: first, flag: 'unflagged', keepRaw: false }] })).status()).toBe(200)
	expect(await flagsOf(page, folder)).toEqual(new Map([[first, { flag: 'unflagged', keepRaw: false, updated: true }], [second, { flag: 'rejected', keepRaw: false, updated: true }]]))
})

// spec: DECISIONS-001.25
test('rejects a malformed flag without writing any', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Malformed ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileId = await upload(page, `${folder}/A.JPG`, JPEG)

	const response = await send(page, 'PUT', '/flags', { flags: [{ fileId, flag: 'picked', keepRaw: false }, { fileId, flag: 'pending', keepRaw: false }] })

	expect(response.status()).toBe(400)
	expect((await flagsOf(page, folder)).get(fileId)?.flag).toBeNull()
})

// spec: DECISIONS-002.3
test('keeps the most recent resume positions, newest first', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	for (let folder = 0; folder <= RECENT_LIMIT; folder++) {
		const folderSet = { paths: [`/Resume/${folder}`, '/Album'], subfolders: true }
		const saved = await send(page, 'PUT', '/positions', { folderSet, fileId: folder + 1, decided: folder, total: RECENT_LIMIT })
		expect(saved.status()).toBe(200)
	}
	const again = { folderSet: { paths: ['/Album', `/Resume/${RECENT_LIMIT}`], subfolders: true }, fileId: 99, decided: 1, total: 2 }
	expect((await send(page, 'PUT', '/positions', again)).status()).toBe(200)

	const recent = await send(page, 'GET', '/positions')
	expect(recent.status()).toBe(200)
	const { positions } = await recent.json() as { positions: { fileId: number, folderSet: unknown }[] }
	expect(positions).toHaveLength(RECENT_LIMIT)
	expect(positions[0]).toMatchObject({ fileId: 99, folderSet: again.folderSet })
	expect(positions.map((position) => position.fileId)).not.toContain(1)
})

// spec: DECISIONS-002.15
test('keeps one resume position for a ticked folder inside another with subfolders', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	expect((await send(page, 'PUT', '/positions', { folderSet: { paths: ['/Covered'], subfolders: true }, fileId: 5, decided: 0, total: 2 })).status()).toBe(200)
	const inside = { paths: ['/Covered', '/Covered/Day 2'], subfolders: true }
	expect((await send(page, 'PUT', '/positions', { folderSet: inside, fileId: 6, decided: 1, total: 2 })).status()).toBe(200)

	const { positions } = await (await send(page, 'GET', '/positions')).json() as { positions: { fileId: number, folderSet: { paths: string[] } }[] }
	const covered = positions.filter((position) => position.folderSet.paths.includes('/Covered'))
	expect(covered).toEqual([expect.objectContaining({ fileId: 6, folderSet: inside })])
})
