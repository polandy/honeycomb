// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }

/** Counted since 14 March 2025, today Thursday 26 November 2026; the busiest day of November is the 24th. */
const ANSWER = {
	counters: [
		{ day: '2025-03-14', metric: 'pictures_decided', value: 30 },
		{ day: '2026-10-05', metric: 'pictures_decided', value: 100 },
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'pictures_picked', value: 30 },
		{ day: '2026-11-02', metric: 'pictures_rejected', value: 10 },
		{ day: '2026-11-24', metric: 'pictures_decided', value: 90 },
		{ day: '2026-11-25', metric: 'pictures_decided', value: 4 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

const calendar = (page: Page) => page.locator('.statistics-calendar')
const square = (page: Page, from: string) => calendar(page).locator(`.statistics-calendar__square[data-from="${from}"]`)
const box = async (locator: Locator) => (await locator.boundingBox())!

// spec: STATS-001.70, STATS-001.71, STATS-001.72
test(`fills the squares by level, hatches the days to come and shows a tapped day in the panel ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)

	await expect(calendar(page).locator('h3')).toContainText('Activity')
	const squares = await calendar(page).locator('.statistics-calendar__grid .statistics-calendar__square').all()
	expect(squares).toHaveLength(30)
	const boxes = await Promise.all(squares.map(box))
	boxes.forEach((first, index) => boxes.slice(index + 1).forEach((second) => {
		const apart = first.x + first.width <= second.x + 1 || second.x + second.width <= first.x + 1 || first.y + first.height <= second.y + 1 || second.y + second.height <= first.y + 1
		expect(apart, 'the squares do not overlap').toBe(true)
	}))

	const full = await box(square(page, '2026-11-24').locator('.statistics-calendar__fill'))
	const middle = await box(square(page, '2026-11-02').locator('.statistics-calendar__fill'))
	const empty = await box(square(page, '2026-11-03').locator('.statistics-calendar__fill'))
	expect(full.height).toBeGreaterThan(middle.height)
	expect(middle.height).toBeGreaterThan(empty.height)
	expect(empty.height).toBe(0)

	expect(await square(page, '2026-11-28').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')
	expect(await square(page, '2026-11-27').evaluate((element) => getComputedStyle(element).borderStyle)).toBe('dashed')
	expect(await square(page, '2026-11-26').evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe('2px')
	expect(await square(page, '2026-11-02').evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums')

	await square(page, '2026-11-02').click()
	await expect(square(page, '2026-11-02')).toHaveAttribute('aria-pressed', 'true')
	const panel = calendar(page).locator('.statistics-bars__detail')
	await expect(panel).toContainText('Nov 2, 2026')
	await expect(panel).toContainText('40 decided (✓ 30 · ✕ 10)')
	await square(page, '2026-11-28').click()
	await expect(panel).toContainText('Still to come.')
	await expect(square(page, '2026-11-02')).toHaveAttribute('aria-pressed', 'false')
	await page.screenshot({ path: testInfo.outputPath('statistics-calendar.png'), fullPage: true, animations: 'disabled' })
})

// spec: STATS-001.70, STATS-001.72
test('shows the year with twelve months and all time with a row per year, and opens a month from all time', async ({ page }) => {
	await openStatistics(page, ANSWER, '#year=2026')
	await expect(calendar(page).locator('.statistics-calendar__group')).toHaveCount(12)
	const january = await box(calendar(page).locator('.statistics-calendar__group').first())
	const february = await box(calendar(page).locator('.statistics-calendar__group').nth(1))
	expect(january.x + january.width <= february.x + 1 || january.y + january.height <= february.y + 1, 'the months do not overlap').toBe(true)
	expect((await box(square(page, '2026-11-24'))).height).toBeGreaterThan(0)

	await openStatistics(page, ANSWER, '#all')
	await expect(calendar(page).locator('.statistics-calendar__group h4')).toHaveText(['2025', '2026'])
	await expect(calendar(page).locator('.statistics-calendar__grid .statistics-calendar__square')).toHaveCount(24)
	await square(page, '2026-10-01').click()
	await calendar(page).locator('.statistics-bars__detail').getByRole('button', { name: 'Show October' }).click()
	await expect(page.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
	expect(await page.evaluate(() => window.location.hash)).toBe('#month=2026-10')
})

test('keeps the squares of a month at the size of a finger on a phone', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await openStatistics(page, ANSWER)

	await expectTouchTargets(calendar(page).locator('.statistics-calendar__grid'), 'the month calendar on a phone')
	expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
})
