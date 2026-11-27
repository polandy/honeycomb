// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { WEBKIT } from './webkit.ts'

const TOLERANCE_PX = 1
const HEIGHT = 900
const PADDING_PX = 16
const BORDER_PX = 1
/** Below this content width the switch takes a row of its own (STATS-001.76). */
const ROW_MIN_WIDTH = 560
const TRANSPARENT = 'rgba(0, 0, 0, 0)'
const WIDTHS = [1440, 1180, 820, 390]

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

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

const box = async (locator: Locator) => (await locator.boundingBox())!
const near = (actual: number, expected: number) => Math.abs(actual - expected) <= TOLERANCE_PX
const middle = (each: { y: number, height: number }) => each.y + each.height / 2
const card = (page: Page) => page.locator('.statistics-bars')

/** The box of an element's text, which shows where it is aligned. */
function textBox(element: Element) {
	const range = document.createRange()
	range.selectNodeContents(element)
	const { left, right } = range.getBoundingClientRect()
	return { left, right }
}

for (const width of WIDTHS) {
	// spec: STATS-001.76
	test(`lays the chart out as a card at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: HEIGHT })
		await openStatistics(page, ANSWER)
		const outer = await box(card(page))
		const inner = { left: outer.x + BORDER_PX + PADDING_PX, right: outer.x + outer.width - BORDER_PX - PADDING_PX, bottom: outer.y + outer.height - BORDER_PX - PADDING_PX }
		const heading = await box(card(page).locator('h3'))
		const headingText = await card(page).locator('h3').evaluate(textBox)
		const chartSwitch = await box(card(page).getByRole('group', { name: 'Chart shows' }))
		const axis = await box(card(page).locator('.statistics-bars__axis'))
		const axisText = await card(page).locator('.statistics-bars__axis span').first().evaluate(textBox)
		const chart = await box(card(page).locator('.statistics-bars__chart'))
		const column = await box(card(page).locator('.statistics-bars__columns').first())
		const legend = await box(card(page).locator('.statistics-bars__legend'))
		const tableSwitch = await box(card(page).getByRole('button', { name: 'Show as table' }))
		const detail = card(page).locator('.statistics-bars__detail')
		const detailBox = await box(detail)

		expect(near(headingText.left, inner.left), 'the heading at the card\'s inner edge').toBe(true)
		expect(near(axisText.left, inner.left), 'the axis labels at the card\'s inner edge').toBe(true)
		expect(near(legend.x, inner.left), 'the key at the card\'s inner edge').toBe(true)
		expect(near(detailBox.x, inner.left) && near(detailBox.x + detailBox.width, inner.right), 'the detail panel across the card').toBe(true)
		expect(near(chartSwitch.x + chartSwitch.width, inner.right), 'Chart shows at the card\'s inner right edge').toBe(true)
		expect(near(chart.x + chart.width, inner.right), 'the bars end at the card\'s inner right edge').toBe(true)
		expect(near(tableSwitch.x + tableSwitch.width, inner.right), 'Show as table at the card\'s inner right edge').toBe(true)

		expect(near(axis.y, column.y) && near(axis.y + axis.height, column.y + column.height), 'the axis as tall as the bars').toBe(true)
		expect(chart.y, 'the bars below the header row').toBeGreaterThanOrEqual(chartSwitch.y + chartSwitch.height)
		expect(Math.min(legend.y, tableSwitch.y), 'the footer row below the bars').toBeGreaterThanOrEqual(chart.y + chart.height)
		expect(detailBox.y, 'the detail panel below the footer row').toBeGreaterThanOrEqual(Math.max(legend.y + legend.height, tableSwitch.y + tableSwitch.height))
		expect(detailBox.y + detailBox.height, 'the detail panel inside the card').toBeLessThanOrEqual(inner.bottom + TOLERANCE_PX)
		expect(await detail.evaluate((element) => getComputedStyle(element).backgroundColor), 'the detail panel filled').not.toBe(TRANSPARENT)

		if (outer.width - 2 * (BORDER_PX + PADDING_PX) >= ROW_MIN_WIDTH) {
			expect(near(middle(heading), middle(chartSwitch)), 'Chart shows on the heading\'s line').toBe(true)
			expect(near(middle(legend), middle(tableSwitch)), 'the key and Show as table on one line').toBe(true)
		} else {
			expect(chartSwitch.y, 'Chart shows below the heading').toBeGreaterThanOrEqual(heading.y + heading.height)
			expect(near(chartSwitch.x, inner.left), 'Chart shows across the card').toBe(true)
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
		await page.screenshot({ path: testInfo.outputPath(`statistics-chart-card-${width}.png`), animations: 'disabled' })
	})
}
