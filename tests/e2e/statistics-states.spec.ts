// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics, statisticsSettled } from './statistics.ts'

const PHONE = { width: 390, height: 844 }

const EMPTY = {
	counters: [],
	firstDay: null,
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** Counted since 1 January 2026, today Saturday 5 December 2026. */
const DECEMBER = {
	counters: [
		{ day: '2026-01-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-12-01', metric: 'pictures_decided', value: 30 },
	],
	firstDay: '2026-01-02',
	today: '2026-12-05',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** Holds the answer of the statistics API until `release` is called. */
async function holdStatistics(page: Page, answer: object): Promise<() => void> {
	let release = () => {}
	const released = new Promise<void>((resolve) => {
		release = resolve
	})
	await page.route('**/apps/honeycomb/api/v1/stats', async (route) => {
		if (route.request().method() !== 'GET') {
			await route.continue()
			return
		}
		await released
		await route.fulfill({ json: answer })
	})
	return release
}

// spec: STATS-001.86
test('draws the skeleton until the numbers answer and then the page in its place', async ({ page }) => {
	await page.goto('about:blank')
	const release = await holdStatistics(page, DECEMBER)

	await page.goto('/index.php/apps/honeycomb/statistics')

	const skeleton = page.locator('.statistics-skeleton')
	await expect(skeleton).toBeVisible()
	await expect(skeleton).toHaveAttribute('aria-busy', 'true')
	await expect(skeleton.getByRole('status')).toHaveText('Loading the statistics…')
	await expect(page.locator('.statistics-hero')).toHaveCount(0)
	const blocks = await skeleton.locator('.statistics-skeleton__block').evaluateAll((all) => all.map((each) => each.getBoundingClientRect()).map(({ x, y, width, height }) => ({ x, y, width, height })))
	expect(blocks.length).toBe(8)
	for (const [index, block] of blocks.entries()) {
		expect(block.width, `skeleton block ${index} has a width`).toBeGreaterThan(0)
		expect(block.height, `skeleton block ${index} has a height`).toBeGreaterThan(0)
		for (const other of blocks.slice(index + 1)) {
			const apart = block.x + block.width <= other.x + 0.5 || other.x + other.width <= block.x + 0.5 || block.y + block.height <= other.y + 0.5 || other.y + other.height <= block.y + 0.5
			expect(apart, `skeleton block ${index} overlaps another`).toBe(true)
		}
	}

	release()
	await statisticsSettled(page)

	await expect(skeleton).toHaveCount(0)
	await expect(page.locator('.statistics-hero')).toBeVisible()
})

// spec: STATS-001.86
test('fits the skeleton into the width of a phone', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('about:blank')
	await holdStatistics(page, EMPTY)

	await page.goto('/index.php/apps/honeycomb/statistics')

	await expect(page.locator('.statistics-skeleton')).toBeVisible()
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
})

// spec: STATS-001.23
test('says nothing is counted yet with a way to the folders and no period bar', async ({ page }, testInfo) => {
	await openStatistics(page, EMPTY)

	const card = page.getByRole('region', { name: 'Nothing counted yet' })
	await expect(card).toBeVisible()
	await expect(card).toContainText('Cull a folder and the numbers show here.')
	await expect(card.getByRole('link', { name: 'Open Folders' })).toHaveAttribute('href', /\/apps\/honeycomb\/$/)
	await expect(page.getByRole('group', { name: 'Period' })).toHaveCount(0)
	await expect(page.locator('.statistics-library')).toBeVisible()
	await expect(page.getByText(/reset/i)).toHaveCount(0)
	const box = await card.boundingBox()
	expect(box!.width).toBeGreaterThan(0)
	await page.screenshot({ path: testInfo.outputPath('statistics-nothing-counted.png'), animations: 'disabled' })
})

// spec: STATS-001.25, STATS-001.48
test('shows the December banner above the period bar and the year in review on demand', async ({ page }, testInfo) => {
	await openStatistics(page, DECEMBER)

	const banner = page.getByRole('region', { name: 'Your 2026 in honeycomb' })
	await expect(banner).toContainText('70 photos decided')
	await expect(banner.locator('.year-review__tile')).toHaveCount(0)
	const bannerBox = (await banner.boundingBox())!
	const periodBox = (await page.getByRole('group', { name: 'Period' }).boundingBox())!
	expect(bannerBox.y + bannerBox.height, 'the banner ends above the period bar').toBeLessThanOrEqual(periodBox.y)

	const show = banner.getByRole('button', { name: 'Show the year in review' })
	await expect(show).toHaveAttribute('aria-expanded', 'false')
	await show.click()

	await expect(banner.getByRole('button', { name: 'Hide the year in review' })).toHaveAttribute('aria-expanded', 'true')
	await expect(banner.locator('.year-review__tile', { hasText: 'Longest streak' })).toBeVisible()
	await expect(banner.locator('.year-review__day')).toHaveCount(365)
	await page.screenshot({ path: testInfo.outputPath('statistics-december.png'), animations: 'disabled' })
})
