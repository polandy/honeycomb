// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }
/** The content width from which the hero stands beside the bars (STATS-001.59). */
const WIDE_CONTENT = 960

/** Counted since 14 March 2025, today Thursday 26 November 2026, nothing in July 2025. */
const ANSWER = {
	counters: [
		{ day: '2025-03-14', metric: 'pictures_decided', value: 30 },
		{ day: '2025-08-02', metric: 'pictures_decided', value: 80 },
		{ day: '2026-10-05', metric: 'pictures_decided', value: 100 },
		{ day: '2026-10-28', metric: 'pictures_decided', value: 50 },
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'pictures_picked', value: 15 },
		{ day: '2026-11-02', metric: 'pictures_rejected', value: 25 },
		{ day: '2026-11-02', metric: 'trash_pictures', value: 10 },
		{ day: '2026-11-02', metric: 'trash_bytes', value: 40_000_000 },
		{ day: '2026-11-24', metric: 'pictures_decided', value: 86 },
		{ day: '2026-11-24', metric: 'pictures_picked', value: 31 },
		{ day: '2026-11-24', metric: 'pictures_rejected', value: 55 },
		{ day: '2026-11-24', metric: 'deleted_pictures', value: 1 },
		{ day: '2026-11-24', metric: 'deleted_bytes', value: 5_000_000 },
		{ day: '2026-11-24', metric: 'raws_removed', value: 3 },
		{ day: '2026-11-24', metric: 'raws_removed_bytes', value: 75_000_000 },
		{ day: '2026-11-24', metric: 'active_seconds', value: 1260 },
		{ day: '2026-11-26', metric: 'pictures_decided', value: 20 },
		{ day: '2026-11-26', metric: 'pictures_picked', value: 8 },
		{ day: '2026-11-26', metric: 'pictures_rejected', value: 12 },
		{ day: '2026-11-26', metric: 'active_seconds', value: 300 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

const hero = (page: Page) => page.getByRole('region', { name: 'Photos decided' })
const tile = (page: Page, label: string) => page.locator('.delete-stats__item', { hasText: label })
const box = async (locator: Locator) => (await locator.boundingBox())!

/** Expects two boxes side by side or stacked, never on top of each other. */
async function expectApart(first: Locator, second: Locator): Promise<void> {
	const a = await box(first)
	const b = await box(second)
	const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
	expect(apart, `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(true)
}

// spec: STATS-001.41, STATS-001.59, STATS-001.60, STATS-001.61, STATS-001.62
test(`shows the hero beside the bars and the four tiles of the month ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)

	await expect(hero(page).locator('.statistics-hero__value')).toHaveText('146')
	await expect(hero(page).locator('.statistics-hero__change')).toHaveText(/^▲ 46\s?% more than Oct 1\s–\s26$/)
	await expect(hero(page).getByRole('img', { name: '54 picked, 92 rejected' })).toBeVisible()
	await expect(hero(page)).toContainText('49 per active day · 3 active days')
	const split = await box(hero(page).locator('.statistics-hero__split'))
	const picked = await box(hero(page).locator('.statistics-hero__picked'))
	const rejected = await box(hero(page).locator('.statistics-hero__rejected'))
	expect(picked.width / split.width).toBeCloseTo(0.37, 1)
	expect(picked.x + picked.width).toBeLessThanOrEqual(rejected.x + 1)
	expect(await hero(page).locator('.statistics-hero__rejected').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')

	await expect(tile(page, 'Space freed')).toContainText('114.4 MB')
	await expect(tile(page, 'Space freed')).toContainText('11 photos · 3 RAW files')
	await expect(tile(page, 'Keep rate')).toContainText('37%')
	await expect(tile(page, 'Keep rate')).toContainText('54 kept of 146')
	await expect(tile(page, 'Active time')).toContainText('26 min 0 s')
	await expect(tile(page, 'Active time')).toContainText('5.6 photos a minute')
	await expect(tile(page, 'Days in a row')).toContainText('Longest 1')
	expect(await hero(page).locator('.statistics-hero__value').evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums')

	const heroBox = await box(hero(page))
	const chartBox = await box(page.locator('.statistics-bars'))
	await expectApart(hero(page), page.locator('.statistics-bars'))
	if ((await box(page.locator('.statistics-page__overview'))).width >= WIDE_CONTENT) {
		expect(Math.abs(heroBox.y - chartBox.y), 'hero and bars side by side').toBeLessThan(1)
	} else {
		expect(chartBox.y, 'the bars below the hero under 960 px of content').toBeGreaterThanOrEqual(heroBox.y + heroBox.height)
	}
	const tiles = page.locator('.delete-stats__item')
	await expect(tiles).toHaveCount(4)
	const rows = new Set(await Promise.all((await tiles.all()).map(async (each) => Math.round((await box(each)).y))))
	expect(rows.size, 'four tiles in one row').toBe(1)
	expect((await box(tiles.first())).y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height)
	await page.screenshot({ path: testInfo.outputPath('statistics-overview-desktop.png'), fullPage: true, animations: 'disabled' })
})

// spec: STATS-001.55, STATS-001.60
test('shows 0 without a change and no keep rate in a month without a count', async ({ page }) => {
	await openStatistics(page, ANSWER, '#month=2025-07')

	await expect(page.locator('.statistics-period__label')).toHaveText('July 2025')
	await expect(hero(page).locator('.statistics-hero__value')).toHaveText('0')
	await expect(hero(page).locator('.statistics-hero__change')).toHaveCount(0)
	await expect(hero(page)).toContainText('No active day in this period')
	await expect(tile(page, 'Keep rate')).toContainText('—')
	await expect(tile(page, 'Keep rate')).toContainText('Nothing decided')
	await expect(tile(page, 'Active time')).toContainText('0 s')
	await expect(page.locator('.statistics-bars__empty')).toBeVisible()
})

// spec: STATS-001.43
test('says statistics are off above the numbers counted so far', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await putSettings(page, { keepStatistics: false })
	await openStatistics(page, ANSWER)

	const note = page.getByText('Statistics are off. Turn on Keep statistics in the settings to count again.')
	await expect(note).toBeVisible()
	await expect(hero(page).locator('.statistics-hero__value')).toHaveText('146')
	expect((await box(note)).y).toBeLessThan((await box(hero(page))).y)
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.59
	test('stacks the hero, the bars and two columns of tiles without a sideways scroll', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await openStatistics(page, ANSWER)

		const heroBox = await box(hero(page))
		const chartBox = await box(page.locator('.statistics-bars'))
		const tiles = page.locator('.delete-stats__item')
		expect(chartBox.y).toBeGreaterThanOrEqual(heroBox.y + heroBox.height)
		expect((await box(tiles.first())).y).toBeGreaterThanOrEqual(chartBox.y + chartBox.height)
		expect((await box(tiles.nth(1))).y).toBe((await box(tiles.first())).y)
		expect((await box(tiles.nth(2))).y).toBeGreaterThan((await box(tiles.first())).y)
		await expectApart(hero(page).locator('.statistics-hero__value'), hero(page).locator('.statistics-hero__change'))
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-overview-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
