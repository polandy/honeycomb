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

/** The fixed width of the period's name between the arrows (STATS-001.74). */
const NAME_WIDTH = 168
const PHONE_LIMIT = 560
const period = (page: Page) => page.getByRole('group', { name: 'Period' })
const previous = (page: Page) => page.getByRole('button', { name: 'Previous period' })
const next = (page: Page) => page.getByRole('button', { name: 'Next period' })
const today = (page: Page) => page.getByRole('button', { name: 'Today' })
const name = (page: Page) => page.locator('.statistics-period__label')
/** Counted since March 2025, so the arrows can step back from November 2026. */
const STEPPABLE = { ...ANSWER, firstDay: '2025-03-14' }

/** The arrows' left edges, which must not move while the user steps. */
const arrows = async (page: Page) => [(await box(previous(page))).x, (await box(next(page))).x]

/** Expects the arrows where `steady` had them, within the tolerance WebKit's sub-pixel layout units need. */
async function expectArrowsAt(page: Page, steady: number[]): Promise<void> {
	const now = await arrows(page)
	now.forEach((x, index) => expect(Math.abs(x - steady[index]!), 'the arrows stay put').toBeLessThanOrEqual(TOLERANCE_PX))
}

/** Expects the segment's buttons to touch each other inside the segment, one group without gaps. */
async function expectOneSegment(page: Page): Promise<void> {
	const segment = await box(period(page))
	const buttons = period(page).getByRole('button')
	await expect(buttons).toHaveCount(4)
	for (let index = 0; index < 4; index++) {
		const button = await box(buttons.nth(index))
		expect(Math.abs(button.y - segment.y), 'the buttons share one line').toBeLessThanOrEqual(TOLERANCE_PX)
		if (index > 0) {
			const before = await box(buttons.nth(index - 1))
			expect(Math.abs(button.x - before.x - before.width), 'no gap between two buttons').toBeLessThanOrEqual(TOLERANCE_PX)
		}
	}
}

for (const width of [1440, 1180, 820]) {
	// spec: STATS-001.74
	test(`puts the segment left and Today before a stepper of fixed width right at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: HEIGHT })
		await openStatistics(page, STEPPABLE)
		const tiles = await box(page.locator('.delete-stats'))
		const right = tiles.x + tiles.width

		await expectOneSegment(page)
		const segment = await box(period(page))
		expect(Math.abs(segment.x - tiles.x), 'the segment starts at the content edge').toBeLessThanOrEqual(TOLERANCE_PX)
		const todayBox = await box(today(page))
		const previousBox = await box(previous(page))
		const nextBox = await box(next(page))
		const nameBox = await box(name(page))
		expect(Math.abs(nameBox.width - NAME_WIDTH)).toBeLessThanOrEqual(TOLERANCE_PX)
		expect(todayBox.x + todayBox.width, 'Today before the stepper').toBeLessThanOrEqual(previousBox.x)
		expect(segment.x + segment.width, 'the segment clear of Today').toBeLessThan(todayBox.x)
		expect(Math.abs(nextBox.x + nextBox.width - right), 'the stepper ends at the content edge').toBeLessThanOrEqual(TOLERANCE_PX)
		for (const control of [todayBox, previousBox, nameBox, nextBox]) {
			expect(Math.abs(control.y + control.height / 2 - (segment.y + segment.height / 2)), 'one row').toBeLessThanOrEqual(TOLERANCE_PX)
		}
		await page.screenshot({ path: testInfo.outputPath(`statistics-controls-${width}.png`), animations: 'disabled' })

		const steady = await arrows(page)
		await previous(page).click()
		await expect(name(page)).toHaveText('October 2026')
		await expectArrowsAt(page, steady)
		await today(page).click()
		await page.getByRole('button', { name: 'Week' }).click()
		await expect(name(page)).toContainText('2026')
		await expectArrowsAt(page, steady)
		await page.getByRole('button', { name: 'Year' }).click()
		await expect(name(page)).toHaveText('2026')
		await expectArrowsAt(page, steady)

		await page.getByRole('button', { name: 'All time' }).click()
		await expect(name(page)).toHaveText('Since Mar 14, 2025')
		await expect(today(page)).toHaveCount(0)
		await expect(previous(page)).toHaveCount(0)
		const since = await box(name(page))
		expect(Math.abs(since.x + since.width - right), 'Since {day} at the right edge').toBeLessThanOrEqual(TOLERANCE_PX)
		expect(since.width).toBeLessThan(width / 2)
	})
}

// spec: STATS-001.74
test(`puts the segment and the stepper on two full-width rows on a phone ${WEBKIT}`, async ({ page }, testInfo) => {
	await page.setViewportSize({ width: 390, height: HEIGHT })
	await openStatistics(page, ANSWER)
	const tiles = await box(page.locator('.delete-stats'))
	expect(tiles.width).toBeLessThan(PHONE_LIMIT)

	await expectOneSegment(page)
	const segment = await box(period(page))
	const stepper = await box(page.locator('.statistics-period__stepper'))
	for (const row of [segment, stepper]) {
		expect(Math.abs(row.x - tiles.x), 'the row starts at the content edge').toBeLessThanOrEqual(TOLERANCE_PX)
		expect(Math.abs(row.width - tiles.width), 'the row spans the content').toBeLessThanOrEqual(TOLERANCE_PX)
	}
	expect(stepper.y, 'the stepper below the segment').toBeGreaterThanOrEqual(segment.y + segment.height)
	const todayBox = await box(today(page))
	expect(todayBox.x + todayBox.width).toBeLessThanOrEqual((await box(previous(page))).x)
	const nextBox = await box(next(page))
	expect(Math.abs(nextBox.x + nextBox.width - tiles.x - tiles.width)).toBeLessThanOrEqual(TOLERANCE_PX)
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
	await page.screenshot({ path: testInfo.outputPath('statistics-controls-390.png'), animations: 'disabled' })
})
