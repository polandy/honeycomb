// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { requestToken } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

/** Sends `data` as JSON with the session's CSRF token. */
async function send(page: Page, method: 'GET' | 'POST' | 'PUT', path: string, data?: unknown) {
	return page.request.fetch(`${API}${path}`, { method, data, headers: { requesttoken: await requestToken(page) } })
}

// spec: TAGS-001.1, TAGS-001.2, TAGS-001.3, TAGS-001.5
test('stores, overwrites and clears tags per file id and keeps the tag list', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const anna = { fileId: 910_001, tags: ['People/Anna', 'Places/Italy/Dolomites'] }
	const sunrise = { fileId: 910_002, tags: ['e2e-Sunrise'] }

	expect((await send(page, 'PUT', '/tags', { tags: [sunrise, { ...anna, tags: [...anna.tags].reverse() }] })).status()).toBe(204)
	const stored = await send(page, 'POST', '/tags/lookup', { fileIds: [910_001, 910_002, 910_003] })
	expect(stored.status()).toBe(200)
	expect(await stored.json()).toEqual({ tags: [anna, sunrise] })

	expect((await send(page, 'PUT', '/tags', { tags: [{ ...anna, tags: ['People/anna'] }, { ...sunrise, tags: [] }] })).status()).toBe(204)
	const overwritten = await send(page, 'POST', '/tags/lookup', { fileIds: [910_001, 910_002] })
	expect(await overwritten.json()).toEqual({ tags: [{ ...anna, tags: ['People/anna'] }] })

	const { tagList } = await (await send(page, 'GET', '/tags/list')).json()
	expect(tagList).toEqual(expect.arrayContaining(['People/Anna', 'People/anna', 'Places/Italy/Dolomites', 'e2e-Sunrise']))
	expect(new Set(tagList).size).toBe(tagList.length)
})

// spec: TAGS-001.6
test('rejects a malformed tag without writing any', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	const response = await send(page, 'PUT', '/tags', { tags: [{ fileId: 910_010, tags: ['e2e-Kept'] }, { fileId: 910_011, tags: ['A|B'] }] })

	expect(response.status()).toBe(400)
	expect(await (await send(page, 'POST', '/tags/lookup', { fileIds: [910_010] })).json()).toEqual({ tags: [] })
	expect((await (await send(page, 'GET', '/tags/list')).json()).tagList).not.toContain('e2e-Kept')
})
