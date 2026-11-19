// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { openLoupe } from './cull.ts'
import { requestToken } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

// spec: TAGS-001.5
test('answers the tag list without duplicates', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	const response = await page.request.get(`${API}/tags/list`, { headers: { requesttoken: await requestToken(page) } })

	expect(response.status()).toBe(200)
	const { tagList } = await response.json() as { tagList: string[] }
	expect(new Set(tagList).size).toBe(tagList.length)
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
	// on the phone the open filter bar and the stored-decisions note leave the grid no height to render cells in
	await page.setViewportSize({ width: 1440, height: 900 })

	await group.getByRole('button', { name: `Remove ${tag} from the filter` }).click()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
})
