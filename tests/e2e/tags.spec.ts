// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { openLoupe } from './cull.ts'
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

// spec: TAGS-003.1, TAGS-003.7, TAGS-003.12, TAGS-004.8
test('tags the loupe\'s photo from the tag entry and closes it with Esc', async ({ page }, testInfo) => {
	const loupe = await openLoupe(page)
	const tag = `e2e-Sunrise-${randomUUID().slice(0, 8)}`

	await page.keyboard.press('t')
	const entry = page.getByRole('dialog', { name: 'Tag entry' })
	const field = entry.getByRole('combobox', { name: 'Tag' })
	await expect(field).toBeFocused()
	await field.fill(tag)
	await expect(entry.getByRole('option', { name: `Create tag "${tag}"` })).toBeVisible()
	await page.keyboard.press('Enter')

	await expect(entry.getByRole('button', { name: `Remove ${tag}` })).toBeVisible()
	await expect(field).toHaveValue('')
	await expect(page.getByText(`Tagged IMG_0001 ${tag}`)).toBeVisible()
	await page.setViewportSize({ width: 1210, height: 834 })
	await page.screenshot({ path: testInfo.outputPath('tag-entry-ipad-landscape.png') })
	await page.emulateMedia({ colorScheme: 'dark' })
	await page.screenshot({ path: testInfo.outputPath('tag-entry-ipad-landscape-dark.png') })
	await page.setViewportSize({ width: 427, height: 952 })
	await page.screenshot({ path: testInfo.outputPath('tag-entry-phone-dark.png') })
	await page.emulateMedia({ colorScheme: 'light' })
	await page.screenshot({ path: testInfo.outputPath('tag-entry-phone.png') })

	await page.keyboard.press('Escape')
	await expect(entry).toBeHidden()
	await expect(loupe).toBeVisible()
	await page.keyboard.press('i')
	const info = page.getByRole('complementary', { name: 'Photo info' })
	await expect(info.getByRole('listitem').filter({ hasText: tag })).toBeVisible()
	await expect(info.getByText('Written to')).toBeVisible()
	await page.setViewportSize({ width: 1210, height: 834 })
	await info.screenshot({ path: testInfo.outputPath('info-tags-ipad-landscape.png') })
	await page.emulateMedia({ colorScheme: 'dark' })
	await info.screenshot({ path: testInfo.outputPath('info-tags-ipad-landscape-dark.png') })
	await page.setViewportSize({ width: 427, height: 952 })
	await info.getByText('Written to').scrollIntoViewIfNeeded()
	await info.screenshot({ path: testInfo.outputPath('info-tags-phone-dark.png') })
	await page.emulateMedia({ colorScheme: 'light' })
	await page.keyboard.press('i')
	await expect(info).toBeHidden()
	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()
})

// spec: TAGS-004.1, TAGS-004.3, TAGS-004.5, TAGS-004.7
test('narrows the grid to a picked tag and counts the tags on the tile', async ({ page }, testInfo) => {
	const loupe = await openLoupe(page)
	const tag = `e2e-Filter-${randomUUID().slice(0, 8)}`
	await page.keyboard.press('t')
	const entry = page.getByRole('dialog', { name: 'Tag entry' })
	await entry.getByRole('combobox', { name: 'Tag' }).fill(tag)
	await page.keyboard.press('Enter')
	await expect(page.getByText(`Tagged IMG_0001 ${tag}`)).toBeVisible()
	await page.keyboard.press('Escape')
	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()

	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell', { name: /^IMG_0001, JPG only, .*1 tag$/ })).toBeVisible()
	await page.getByRole('button', { name: /Filter/ }).first().click()
	const group = page.locator('.filter-bar').getByRole('group', { name: 'Tags' })
	await group.getByRole('button', { name: 'Add tag' }).click()
	const filter = page.getByRole('dialog', { name: 'Tag filter' })
	await filter.getByRole('combobox', { name: 'Tag' }).fill(tag.toUpperCase())
	await page.keyboard.press('Enter')
	await page.keyboard.press('Escape')

	await expect(group.getByRole('button', { name: `Remove ${tag} from the filter` })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(grid.getByRole('gridcell', { name: /^IMG_0001, JPG only, .*1 tag$/ })).toBeVisible()
	await page.setViewportSize({ width: 1210, height: 834 })
	await page.screenshot({ path: testInfo.outputPath('tag-filter-ipad-landscape.png') })
	await page.emulateMedia({ colorScheme: 'dark' })
	await page.screenshot({ path: testInfo.outputPath('tag-filter-ipad-landscape-dark.png') })
	await page.setViewportSize({ width: 427, height: 952 })
	await page.screenshot({ path: testInfo.outputPath('tag-filter-phone-dark.png') })
	await page.emulateMedia({ colorScheme: 'light' })

	await group.getByRole('button', { name: `Remove ${tag} from the filter` }).click()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
})
