// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { WEBKIT } from './webkit.ts'

const TOLERANCE_PX = 1
const HEIGHT = 900
const PADDING_PX = 16
const BORDER_PX = 1
const COLUMNS = 4
const GAP_PX = 16
/** Label, value and note of one line each, with the padding and the borders, stay below this. */
const TILE_MAX_HEIGHT_PX = 130
/** From this width the page has 960 px of content, four tiles wide. */
const WIDE_MIN_WIDTH = 1180
const WIDTHS = [1440, 1180, 820, 390]
const LABELS = ['Space freed', 'Keep rate', 'Active time', 'Days in a row']

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

/** The left edge of an element's text. */
function textLeft(element: Element) {
	const range = document.createRange()
	range.selectNodeContents(element)
	return range.getBoundingClientRect().left
}

for (const width of WIDTHS) {
	// spec: STATS-001.77
	test(`shapes the four tiles as cards, the label first, at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: HEIGHT })
		await openStatistics(page, ANSWER)
		const tiles = page.locator('.statistics-page .delete-stats__item')
		await expect(tiles).toHaveCount(COLUMNS)
		const grid = await box(page.locator('.statistics-page .delete-stats'))
		const boxes = await Promise.all((await tiles.all()).map((tile) => box(tile)))

		for (const [index, tile] of (await tiles.all()).entries()) {
			const outer = boxes[index]!
			const label = await box(tile.locator('.delete-stats__label'))
			const value = await box(tile.locator('.delete-stats__value'))
			const note = await box(tile.locator('.delete-stats__note'))
			const inset = BORDER_PX + PADDING_PX
			await expect(tile.locator('.delete-stats__label')).toHaveText(LABELS[index]!)
			expect(label.y + label.height, 'the label above the value').toBeLessThanOrEqual(value.y + TOLERANCE_PX)
			expect(value.y + value.height, 'the value above the note').toBeLessThanOrEqual(note.y + TOLERANCE_PX)
			expect(near(label.y, outer.y + inset), '16 px above the label').toBe(true)
			expect(near(outer.y + outer.height - inset, note.y + note.height), '16 px below the note').toBe(true)
			for (const part of ['.delete-stats__label', '.delete-stats__value', '.delete-stats__note']) {
				expect(near(await tile.locator(part).evaluate(textLeft), outer.x + inset), `16 px before the ${part} text`).toBe(true)
			}
			expect(outer.height, 'a tile with one line of each').toBeLessThanOrEqual(TILE_MAX_HEIGHT_PX)
		}
		for (const top of new Set(boxes.map((each) => Math.round(each.y)))) {
			const row = boxes.filter((each) => Math.round(each.y) === top)
			expect(new Set(row.map((each) => Math.round(each.height))).size, 'equal height per row').toBe(1)
		}
		if (width >= WIDE_MIN_WIDTH) {
			expect(new Set(boxes.map((each) => Math.round(each.y))).size, 'four tiles in one row').toBe(1)
		}
		expect(near(boxes[0]!.x, grid.x), 'the first tile at the grid edge').toBe(true)
		if (near(boxes[0]!.y, boxes[1]!.y)) {
			expect(near(boxes[0]!.x + boxes[0]!.width + GAP_PX, boxes[1]!.x), '16 px between tiles').toBe(true)
		}
		await page.screenshot({ path: testInfo.outputPath(`statistics-tiles-${width}.png`), animations: 'disabled' })
	})
}

test.describe('on a touch screen', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.77
	test(`keeps the tiles' lines at their text height ${WEBKIT}`, async ({ page }) => {
		await page.setViewportSize({ width: 1180, height: 820 })
		await openStatistics(page, ANSWER)
		const tiles = page.locator('.statistics-page .delete-stats__item')
		await expect(tiles).toHaveCount(COLUMNS)
		for (const tile of await tiles.all()) {
			expect((await box(tile)).height, 'a tile with one line of each').toBeLessThanOrEqual(TILE_MAX_HEIGHT_PX)
		}
	})
})
