// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { requestToken } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const RECENT_LIMIT = 20

/** Sends `data` as JSON with the session's CSRF token. */
async function send(page: Page, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) {
	return page.request.fetch(`${API}${path}`, { method, data, headers: { requesttoken: await requestToken(page) } })
}

// spec: DECISIONS-001.1, DECISIONS-001.2, DECISIONS-001.3
test('stores, overwrites and clears decisions per file id', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const picked = { fileId: 900_001, rating: 4, colourLabel: 'green', flag: 'picked', keepRaw: true }
	const rejected = { fileId: 900_002, rating: 0, colourLabel: null, flag: 'rejected', keepRaw: false }

	expect((await send(page, 'PUT', '/decisions', { decisions: [picked, rejected] })).status()).toBe(204)
	const stored = await send(page, 'POST', '/decisions/lookup', { fileIds: [900_001, 900_002, 900_003] })
	expect(stored.status()).toBe(200)
	expect(await stored.json()).toEqual({ decisions: [picked, rejected] })

	const unflagged = { ...rejected, flag: 'unflagged' }
	expect((await send(page, 'PUT', '/decisions', { decisions: [{ ...picked, rating: 2 }, unflagged] })).status()).toBe(204)
	const overwritten = await send(page, 'POST', '/decisions/lookup', { fileIds: [900_001, 900_002] })
	expect(await overwritten.json()).toEqual({ decisions: [{ ...picked, rating: 2 }] })
})

// spec: DECISIONS-001.5
test('rejects a malformed decision without writing any', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const decision = { fileId: 900_010, rating: 1, colourLabel: null, flag: 'unflagged', keepRaw: false }

	const response = await send(page, 'PUT', '/decisions', { decisions: [decision, { ...decision, fileId: 900_011, flag: 'pending' }] })

	expect(response.status()).toBe(400)
	expect(await (await send(page, 'POST', '/decisions/lookup', { fileIds: [900_010] })).json()).toEqual({ decisions: [] })
})

// spec: DECISIONS-002.3
test('keeps the most recent resume positions, newest first', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	for (let folder = 0; folder <= RECENT_LIMIT; folder++) {
		const folderSet = { paths: [`/Resume/${folder}`, '/Resume'], subfolders: true }
		const saved = await send(page, 'PUT', '/positions', { folderSet, fileId: folder + 1, decided: folder, total: RECENT_LIMIT })
		expect(saved.status()).toBe(200)
	}
	const again = { folderSet: { paths: ['/Resume', `/Resume/${RECENT_LIMIT}`], subfolders: true }, fileId: 99, decided: 1, total: 2 }
	expect((await send(page, 'PUT', '/positions', again)).status()).toBe(200)

	const recent = await send(page, 'GET', '/positions')
	expect(recent.status()).toBe(200)
	const { positions } = await recent.json() as { positions: { fileId: number, folderSet: unknown }[] }
	expect(positions).toHaveLength(RECENT_LIMIT)
	expect(positions[0]).toMatchObject({ fileId: 99, folderSet: again.folderSet })
	expect(positions.map((position) => position.fileId)).not.toContain(1)
})
