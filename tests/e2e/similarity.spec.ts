// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiHeaders, createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const HASH = /^[0-9a-f]{16}$/

// spec: SERIES-004.13, SERIES-004.1
test('computes the missing hashes of a folder tree in workers and stores them', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/similarity')
	const folder = `Similarity ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await createFolder(page, `${folder}/2026`)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/2026/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:10'))
	const missing = async () => {
		const answer = await page.request.get(`${API}/visual-hashes/missing`, { params: { path: `/${folder}`, after: '' }, headers: await apiHeaders(page) })
		expect(answer.status(), await answer.text()).toBe(200)
		return answer.json() as Promise<{ pictures: { path: string }[], next: string | null }>
	}
	expect((await missing()).pictures.map((picture) => picture.path)).toEqual([`/${folder}/2026/IMG_0002.jpg`, `/${folder}/IMG_0001.jpg`])
	await page.reload()

	await page.getByRole('treeitem', { name: folder }).click()
	await page.getByRole('button', { name: 'Start' }).click()

	await expect(page.getByText('Done: every photo in this folder has its similarity.')).toBeVisible()
	expect(await missing()).toEqual({ pictures: [], next: null })
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}/2026` }, headers: await apiHeaders(page) })
	const entries = (await listing.json() as { entries: { visualHash: string | null }[] }).entries
	expect(entries[0]!.visualHash).toMatch(HASH)
})
