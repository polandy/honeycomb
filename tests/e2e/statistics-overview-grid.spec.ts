// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { WEBKIT } from './webkit.ts'

const TOLERANCE_PX = 1
const HEIGHT = 900
const COLUMNS = 4
const GAP_PX = 16
const ROWS = ['✓ Picked', '✕ Rejected', 'Per active day', 'Active days']

/** Counted on two days of November 2026, today Thursday 26 November 2026. */
const ANSWER = {
	counters: [
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'pictures_picked', value: 15 },
		{ day: '2026-11-02', metric: 'pictures_rejected', value: 25 },
		{ day: '2026-11-26', metric: 'pictures_decided', value: 20 },
		{ day: '2026-11-26', metric: 'active_seconds', value: 300 },
	],
	firstDay: '2026-11-02',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** The overview each viewport gets; below 1280 px the navigation starts closed (NAVIGATION_OPEN_MIN_WIDTH). */
const LAYOUTS = [
	{ width: 1440, layout: 'columns' },
	{ width: 1180, layout: 'columns' },
	{ width: 820, layout: 'band' },
	{ width: 390, layout: 'stacked' },
] as const

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

const box = async (locator: Locator) => (await locator.boundingBox())!
const near = (actual: number, expected: number) => Math.abs(actual - expected) <= TOLERANCE_PX
const hero = (page: Page) => page.getByRole('region', { name: 'Photos decided' })
const rows = (page: Page) => hero(page).locator('.statistics-hero__row')

/** The rows' boxes after checking that each names its figure, the name at the row's start and the figure at its end. */
async function rowBoxes(page: Page) {
	await expect(rows(page).locator('dt')).toHaveText(ROWS)
	await expect(rows(page).locator('dd')).toHaveText(['15', '25', '30', '2'])
	return Promise.all((await rows(page).all()).map(async (row) => {
		const rowBox = await box(row)
		const name = await row.locator('dt').evaluate(textBox)
		const figure = await row.locator('dd').evaluate(textBox)
		expect(near(name.left, rowBox.x), 'the name at the row\'s start').toBe(true)
		expect(near(figure.right, rowBox.x + rowBox.width), 'the figure at the row\'s end').toBe(true)
		return rowBox
	}))
}

/** The box of an element's text, which shows where it is aligned. */
function textBox(element: Element) {
	const range = document.createRange()
	range.selectNodeContents(element)
	const { left, right } = range.getBoundingClientRect()
	return { left, right }
}

for (const { width, layout } of LAYOUTS) {
	// spec: STATS-001.59, STATS-001.75
	test(`lays the hero and the bars out as ${layout} at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: HEIGHT })
		await openStatistics(page, ANSWER)
		const grid = await box(page.locator('.statistics-page__overview'))
		const heroBox = await box(hero(page))
		const chart = await box(page.locator('.statistics-bars'))
		const value = await box(hero(page).locator('.statistics-hero__value'))
		const split = await box(hero(page).locator('.statistics-hero__split'))
		const [picked, rejected, perDay, days] = await rowBoxes(page)
		expect(near(heroBox.x, grid.x), 'the hero starts at the content edge').toBe(true)

		if (layout === 'columns') {
			expect(near(heroBox.width, (grid.width - (COLUMNS - 1) * GAP_PX) / COLUMNS), 'the hero is one of four columns').toBe(true)
			expect(near(chart.x, heroBox.x + heroBox.width + GAP_PX), '16 px between hero and bars').toBe(true)
			expect(near(chart.x + chart.width, grid.x + grid.width), 'the bars take the other three columns').toBe(true)
			expect(near(chart.y, heroBox.y) && near(chart.height, heroBox.height), 'hero and bars equally tall on one line').toBe(true)
			for (const [above, below] of [[picked, rejected], [rejected, perDay], [perDay, days]]) {
				expect(below.y, 'one row below the other').toBeGreaterThanOrEqual(above.y + above.height - TOLERANCE_PX)
			}
			expect(heroBox.y + heroBox.height - days.y - days.height, 'the rows fill the hero').toBeLessThanOrEqual(GAP_PX + 2 * TOLERANCE_PX)
		} else {
			expect(near(heroBox.width, grid.width), 'the hero spans the content').toBe(true)
			expect(chart.y, 'the bars below the hero').toBeGreaterThanOrEqual(heroBox.y + heroBox.height)
		}
		if (layout === 'band') {
			expect(split.x, 'the bar beside the number').toBeGreaterThanOrEqual(value.x + value.width)
			expect(near(picked.y, rejected.y) && near(perDay.y, days.y), 'the rows in two columns').toBe(true)
			expect(perDay.y).toBeGreaterThanOrEqual(picked.y + picked.height - TOLERANCE_PX)
		}
		if (layout === 'stacked') {
			expect(split.y, 'the bar below the number').toBeGreaterThanOrEqual(value.y + value.height)
			for (const row of [picked, rejected, perDay, days]) {
				expect(near(row.x, split.x) && near(row.width, split.width), 'each row as wide as the bar').toBe(true)
			}
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
		await page.screenshot({ path: testInfo.outputPath(`statistics-overview-${width}.png`), animations: 'disabled' })
	})
}
