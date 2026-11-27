// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { WEBKIT } from './webkit.ts'

/** The shared column of the title row and the page (STATS-001.73). */
const PAGE_WIDTH = 1040
const TOLERANCE_PX = 1
const HEIGHT = 900

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
const titleRow = (page: Page) => page.locator('.page-title-row')
const back = (page: Page) => titleRow(page).getByRole('link', { name: 'Back to the cull' })
const firstCard = (page: Page) => page.getByRole('region', { name: 'Photos decided' })

/** The title's text box, which is what lines up with the cards and what the toggle must not cover. */
function titleBox(page: Page) {
	return titleRow(page).getByRole('heading', { name: 'Statistics' }).evaluate((heading) => {
		const range = document.createRange()
		range.selectNodeContents(heading)
		const { left, right, top, bottom } = range.getBoundingClientRect()
		return { left, right, top, bottom }
	})
}

/** Opens the page at `width` and expects Back to the cull on the title's line and no sideways scroll. */
async function openAt(page: Page, width: number): Promise<void> {
	await page.setViewportSize({ width, height: HEIGHT })
	await openStatistics(page, ANSWER)
	await expect(back(page)).toBeVisible()
	const title = await titleBox(page)
	const link = await box(back(page))
	expect(link.x, 'Back to the cull right of the title').toBeGreaterThanOrEqual(title.right)
	expect(link.y, 'Back to the cull on the title line').toBeLessThanOrEqual(title.top)
	expect(link.y + link.height).toBeGreaterThanOrEqual(title.bottom)
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
}

for (const width of [1180, 1440]) {
	// spec: STATS-001.73
	test(`lines the title up with the first card in one centred column at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await openAt(page, width)

		const card = await box(firstCard(page))
		expect(Math.abs((await titleBox(page)).left - card.x), 'title and first card share the left edge').toBeLessThanOrEqual(TOLERANCE_PX)
		const tiles = await box(page.locator('.delete-stats'))
		const link = await box(back(page))
		expect(Math.abs(link.x + link.width - (tiles.x + tiles.width)), 'Back to the cull ends at the cards').toBeLessThanOrEqual(TOLERANCE_PX)
		const content = await box(page.locator('.app-content'))
		const column = await box(page.locator('.statistics-page'))
		const row = await box(titleRow(page))
		expect(column.width).toBeLessThanOrEqual(PAGE_WIDTH)
		expect(Math.abs(row.x - column.x)).toBeLessThanOrEqual(TOLERANCE_PX)
		expect(Math.abs(row.width - column.width)).toBeLessThanOrEqual(TOLERANCE_PX)
		expect(Math.abs(column.x - content.x - (content.x + content.width - column.x - column.width)), 'the column is centred').toBeLessThanOrEqual(TOLERANCE_PX)
		await page.screenshot({ path: testInfo.outputPath(`statistics-layout-${width}.png`), animations: 'disabled' })
	})
}

for (const width of [820, 390]) {
	// spec: STATS-001.73, APP-001.22
	test(`keeps the title clear of the navigation toggle at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await openAt(page, width)

		const toggle = await box(page.locator('.app-navigation-toggle'))
		expect((await titleBox(page)).left).toBeGreaterThanOrEqual(toggle.x + toggle.width)
		const link = await box(back(page))
		expect(link.x + link.width).toBeLessThanOrEqual(width)
		await page.screenshot({ path: testInfo.outputPath(`statistics-layout-${width}.png`), animations: 'disabled' })
	})
}
