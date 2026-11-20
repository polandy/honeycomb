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

/** An answer of the statistics API for a year of counters, which the page shows as the year in review. */
const YEAR_ANSWER = {
	counters: [
		{ day: '2026-03-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-03-02', metric: 'trash_pictures', value: 12 },
		{ day: '2026-03-02', metric: 'trash_bytes', value: 48_000_000 },
		{ day: '2026-03-03', metric: 'pictures_decided', value: 20 },
		{ day: '2026-03-03', metric: 'sidecars_foreign', value: 3 },
		{ day: '2026-03-03', metric: 'active_seconds', value: 600 },
		{ day: '2026-07-14', metric: 'pictures_decided', value: 10 },
	],
	firstDay: '2026-01-01',
	today: '2026-12-05',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** Answers the statistics API with the year of counters instead of the server's. */
async function stubYear(page: Page): Promise<void> {
	await page.route('**/apps/honeycomb/api/v1/stats', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: YEAR_ANSWER }) : route.continue()))
}

// spec: STATS-001.46, STATS-001.47, STATS-001.49
test('shows the year in review above the periods on the desktop', async ({ page }, testInfo) => {
	await stubYear(page)

	await page.goto('/index.php/apps/honeycomb/statistics')

	const review = page.getByRole('region', { name: 'Your 2026 in honeycomb' })
	await expect(review).toContainText('70 photos decided')
	await expect(review.locator('.year-review__tile', { hasText: 'Busiest day' })).toContainText('40 photos decided')
	await expect(review.locator('.year-review__tile', { hasText: 'Longest streak' })).toContainText('2 days in a row')
	await expect(review.locator('.year-review__tile', { hasText: 'Sidecars updated' })).toContainText('3 from digiKam or darktable')
	await expect(review.locator('.year-review__day')).toHaveCount(365)
	await expect(review.locator('.year-review__day[data-shade="3"]')).toHaveCount(1)
	await expect(review).toContainText('Counted since Jan 1, 2026')
	await page.screenshot({ path: testInfo.outputPath('year-review-desktop.png'), animations: 'disabled' })
})

// spec: STATS-001.46
test('fits the year in review on a phone', async ({ page }, testInfo) => {
	await page.setViewportSize(PHONE)
	await stubYear(page)

	await page.goto('/index.php/apps/honeycomb/statistics')

	await expect(page.getByRole('region', { name: 'Your 2026 in honeycomb' })).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
	await page.screenshot({ path: testInfo.outputPath('year-review-phone.png'), fullPage: true, animations: 'disabled' })
})

// spec: STATS-001.26, STATS-001.48
test('shows the hint from 1 December, closes it for good', async ({ page }, testInfo) => {
	await page.clock.setFixedTime(new Date(2026, 11, 1, 12))
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const closed = await page.request.put(`${API}/view-state`, { data: { viewState: { yearReviewHintClosed: 2000 } }, headers: await apiHeaders(page) })
	expect(closed.status(), await closed.text()).toBe(200)
	const folder = `Statistics ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)

	const hint = page.locator('.app-navigation__hint')
	await expect(hint).toContainText('Your 2026 in honeycomb')
	await page.screenshot({ path: testInfo.outputPath('year-review-hint.png'), animations: 'disabled' })
	await hint.getByRole('button', { name: 'Close' }).click()
	await expect(hint).toHaveCount(0)
	await expect.poll(async () => (await (await page.request.get(`${API}/view-state`, { headers: await apiHeaders(page) })).json()).viewState.yearReviewHintClosed).toBe(2026)
})
