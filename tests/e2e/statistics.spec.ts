// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'
import { expectTouchTargets } from './touch-targets.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const PHONE = { width: 390, height: 844 }

/** Resets the statistics, then counts active time through the position save of a new folder set of one photo. */
async function countActiveTime(page: Page): Promise<string> {
	expect((await page.request.delete(`${API}/stats`, { headers: await apiHeaders(page) })).status()).toBe(204)
	const folder = `Statistics ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileId = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	const saved = await page.request.put(`${API}/positions`, {
		data: { folderSet: { paths: [`/${folder}`], subfolders: false }, fileId, decided: 1, total: 1, activeSeconds: 1 },
		headers: await apiHeaders(page),
	})
	expect(saved.status(), await saved.text()).toBe(200)
	return folder
}

// spec: STATS-001.40, STATS-001.23
test('opens the statistics page from the navigation and says nothing is counted yet', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Statistics ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	expect((await page.request.delete(`${API}/stats`, { headers: await apiHeaders(page) })).status()).toBe(204)

	await page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: 'Statistics' }).click()

	await expect(page).toHaveURL(/\/apps\/honeycomb\/statistics$/)
	await expect(page.getByRole('heading', { name: 'Statistics' })).toBeVisible()
	await expect(page.getByText('Nothing counted yet. Cull a folder and the numbers show here.')).toBeVisible()
	await page.getByRole('link', { name: 'Back to the cull' }).click()
	await expect(page).toHaveURL(/\/apps\/honeycomb\/$/)
})

// spec: STATS-001.21, STATS-001.24, STATS-001.42
test('shows the counted numbers, the folder sets and since when it counts on the desktop', async ({ page }, testInfo) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = await countActiveTime(page)

	await page.goto('/index.php/apps/honeycomb/statistics')

	await expect(page.getByRole('button', { name: '30 days' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.delete-stats__item', { hasText: 'Days in a row' })).toContainText('1')
	await expect(page.locator('.statistics-folder-sets__row', { hasText: folder })).toContainText('Done')
	await expect(page.getByText(/^Counted since /)).toBeVisible()
	await page.getByRole('button', { name: '7 days' }).click()
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(7)
	await page.screenshot({ path: testInfo.outputPath('statistics-desktop.png'), animations: 'disabled' })
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.21
	test('fits the page into the width of a phone with 44 px period chips', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await page.goto('/index.php/apps/honeycomb/')
		await countActiveTime(page)

		await page.goto('/index.php/apps/honeycomb/statistics')

		const periods = page.getByRole('group', { name: 'Period' })
		await expect(periods).toBeVisible()
		await expectTouchTargets(periods, 'statistics period chips on a phone')
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
