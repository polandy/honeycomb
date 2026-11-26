// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }
/** formatFileSize counts binary megabytes. */
const MB = 1024 * 1024

/** Counted since 14 March 2025, today Thursday 26 November 2026. */
const ANSWER = {
	counters: [
		{ day: '2025-03-14', metric: 'pictures_decided', value: 30 },
		{ day: '2026-10-05', metric: 'pictures_decided', value: 100 },
		{ day: '2026-10-05', metric: 'pictures_picked', value: 40 },
		{ day: '2026-10-05', metric: 'pictures_rejected', value: 60 },
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'pictures_picked', value: 15 },
		{ day: '2026-11-02', metric: 'pictures_rejected', value: 25 },
		{ day: '2026-11-02', metric: 'trash_bytes', value: 40 * MB },
		{ day: '2026-11-24', metric: 'pictures_decided', value: 86 },
		{ day: '2026-11-24', metric: 'pictures_picked', value: 31 },
		{ day: '2026-11-24', metric: 'pictures_rejected', value: 55 },
		{ day: '2026-11-24', metric: 'trash_bytes', value: 20 * MB },
		{ day: '2026-11-24', metric: 'deleted_bytes', value: 5 * MB },
		{ day: '2026-11-24', metric: 'raws_removed_bytes', value: 75 * MB },
		{ day: '2026-11-24', metric: 'active_seconds', value: 1260 },
		{ day: '2026-11-26', metric: 'pictures_decided', value: 20 },
		{ day: '2026-11-26', metric: 'pictures_picked', value: 8 },
		{ day: '2026-11-26', metric: 'pictures_rejected', value: 12 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** The bar button whose label starts with `name`. */
const bar = (page: Page, name: string) => page.locator(`.statistics-bars__columns[aria-label^="${name}:"]`)
const detail = (page: Page) => page.locator('.statistics-bars .statistics-bars__detail')
const box = async (locator: Locator) => (await locator.boundingBox())!

/** Expects the detail panel below the bars, never over them. */
async function expectPanelBelow(page: Page): Promise<void> {
	const chart = await box(page.locator('.statistics-bars__chart'))
	expect((await box(detail(page))).y, 'the detail panel below the chart').toBeGreaterThanOrEqual(chart.y + chart.height)
}

// spec: STATS-001.63, STATS-001.64
test(`shows a tapped bar's numbers in the panel below the stacked chart ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)
	await expect(detail(page)).toHaveText('Select a bar to see its numbers.')
	await expect(detail(page)).toHaveAttribute('aria-live', 'polite')

	const tuesday = bar(page, 'Tue, Nov 24, 2026')
	await expect(tuesday).toHaveAttribute('aria-label', 'Tue, Nov 24, 2026: 86 photos decided, 31 picked, 55 rejected')
	const picked = await box(tuesday.locator('.statistics-bars__part--picked'))
	const rejected = await box(tuesday.locator('.statistics-bars__part--rejected'))
	expect(picked.height).toBeGreaterThan(0)
	expect(rejected.height / picked.height).toBeCloseTo(55 / 31, 1)
	expect(rejected.y + rejected.height, 'rejected stacked on picked').toBeLessThanOrEqual(picked.y + 1)
	expect(await tuesday.locator('.statistics-bars__part--rejected').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')

	await tuesday.click()
	await expect(tuesday).toHaveAttribute('aria-pressed', 'true')
	await expect(detail(page)).toContainText('Tue, Nov 24, 2026')
	await expect(detail(page)).toContainText('86 decided (✓ 31 · ✕ 55)')
	await expect(detail(page)).toContainText('100 MB freed')
	await expect(detail(page)).toContainText('21 min 0 s active')
	await expect(page.locator('.tip-bubble')).toHaveCount(0)
	await expectPanelBelow(page)
	expect(await detail(page).evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums')
	await page.screenshot({ path: testInfo.outputPath('statistics-chart-held.png'), fullPage: true, animations: 'disabled' })

	await bar(page, 'Mon, Nov 2, 2026').hover()
	await expect(detail(page)).toContainText('40 decided (✓ 15 · ✕ 25)')
	await page.locator('.statistics-period__label').hover()
	await expect(detail(page)).toContainText('86 decided')

	await tuesday.click()
	await expect(tuesday).toHaveAttribute('aria-pressed', 'false')
	await expect(detail(page)).toHaveText('Select a bar to see its numbers.')
})

// spec: STATS-001.64
test('holds a bar with Enter and releases it with Space from the keyboard', async ({ page }) => {
	await openStatistics(page, ANSWER)
	const thursday = bar(page, 'Thu, Nov 26, 2026')

	await thursday.focus()
	await page.keyboard.press('Enter')
	await expect(thursday).toHaveAttribute('aria-pressed', 'true')
	await expect(detail(page)).toContainText('20 decided (✓ 8 · ✕ 12)')
	expect(await thursday.evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')

	await page.keyboard.press('Space')
	await expect(thursday).toHaveAttribute('aria-pressed', 'false')
	await expect(detail(page)).toHaveText('Select a bar to see its numbers.')
})

// spec: STATS-001.63
test('switches the chart to space freed and active time', async ({ page }) => {
	await openStatistics(page, ANSWER)
	const tuesday = () => page.locator('.statistics-bars__bar[data-from="2026-11-24"]')

	await page.getByRole('button', { name: 'Space freed' }).click()
	await expect(page.getByRole('button', { name: 'Space freed' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.getByRole('button', { name: 'Decided' })).toHaveAttribute('aria-pressed', 'false')
	await expect(page.locator('.statistics-bars h3')).toHaveText('Space freed per day')
	await expect(tuesday().locator('button')).toHaveAttribute('aria-label', 'Tue, Nov 24, 2026: 100 MB freed')
	const raws = await box(tuesday().locator('.statistics-bars__part--raws'))
	const trash = await box(tuesday().locator('.statistics-bars__part--trash'))
	expect(raws.height / trash.height).toBeCloseTo(75 / 20, 1)
	expect(await tuesday().locator('.statistics-bars__part--raws').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('radial-gradient')
	expect(await tuesday().locator('.statistics-bars__part--deleted').evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')
	await expect(page.locator('.statistics-bars__legend')).toContainText('RAWs removed')

	await page.getByRole('button', { name: 'Active time' }).click()
	await expect(tuesday().locator('button')).toHaveAttribute('aria-label', 'Tue, Nov 24, 2026: 21 min 0 s active')
	expect((await box(tuesday().locator('.statistics-bars__part--active'))).height).toBeGreaterThan(0)
	await expect(page.locator('.statistics-bars__axis span').first()).toHaveText('21 min 0 s')
})

// spec: STATS-001.66
test('shows the chart as a table and back', async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)

	await page.getByRole('button', { name: 'Show as table' }).click()
	const table = page.getByRole('table')
	await expect(table).toBeVisible()
	await expect(page.locator('.statistics-bars__chart')).toHaveCount(0)
	await expect(table.getByRole('row')).toHaveCount(27)
	await expect(table.getByRole('row', { name: /Nov 24, 2026/ }).getByRole('cell')).toHaveText(['Tue, Nov 24, 2026', '31', '55'])
	await page.locator('.statistics-bars').screenshot({ path: testInfo.outputPath('statistics-chart-table.png'), animations: 'disabled' })

	await page.getByRole('button', { name: 'Show as chart' }).click()
	await expect(page.getByRole('table')).toHaveCount(0)
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(30)
})

// spec: STATS-001.65
test('drills down from a month of the year to that month', async ({ page }) => {
	await openStatistics(page, ANSWER, '#year=2026')

	await bar(page, 'October 2026').click()
	await expect(detail(page)).toContainText('100 decided (✓ 40 · ✕ 60)')
	await detail(page).getByRole('button', { name: 'Show October' }).click()

	await expect(page.locator('.statistics-period__label')).toHaveText('October 2026')
	await expect(page.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(31)
	expect(await page.evaluate(() => window.location.hash)).toBe('#month=2026-10')
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.63, STATS-001.64
	test('fits the switch, the chart and the panel into the width of a phone', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await openStatistics(page, ANSWER)

		await expectTouchTargets(page.getByRole('group', { name: 'Chart shows' }), 'chart switch on a phone')
		await expectTouchTargets(page.locator('.statistics-bars__table-switch'), 'table switch on a phone')
		await bar(page, 'Tue, Nov 24, 2026').click()
		await expect(detail(page)).toContainText('86 decided')
		await expectPanelBelow(page)
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-chart-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
