// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }
const TOLERANCE_PX = 1
const HEIGHT = 900
const CELLS = 5
/** The overview each viewport gets; the strip needs 880 px of the page's column. */
const LAYOUTS = [
	{ width: 1440, layout: 'strip' },
	{ width: 1180, layout: 'strip' },
	{ width: 820, layout: 'rows' },
	{ width: 390, layout: 'rows' },
] as const

/** Counted since 14 March 2025, today Thursday 26 November 2026; the best day of November is Tuesday the 24th. */
const ANSWER = {
	counters: [
		{ day: '2025-03-14', metric: 'pictures_decided', value: 30 },
		{ day: '2026-10-05', metric: 'pictures_decided', value: 100 },
		{ day: '2026-10-05', metric: 'active_seconds', value: 600 },
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'active_seconds', value: 600 },
		{ day: '2026-11-24', metric: 'pictures_decided', value: 86 },
		{ day: '2026-11-24', metric: 'active_seconds', value: 1260 },
		{ day: '2026-11-25', metric: 'pictures_decided', value: 4 },
		{ day: '2026-11-26', metric: 'pictures_decided', value: 20 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

const highlights = (page: Page) => page.locator('.statistics-highlights')
const card = (page: Page, title: string) => highlights(page).locator('.statistics-highlights__cell', { has: page.getByRole('heading', { name: title, level: 4 }) })
const box = async (locator: Locator) => (await locator.boundingBox())!
const near = (actual: number, expected: number) => Math.abs(actual - expected) <= TOLERANCE_PX

/** The box of an element's text, which shows where it is aligned. */
function textBox(element: Element) {
	const range = document.createRange()
	range.selectNodeContents(element)
	const { left, right } = range.getBoundingClientRect()
	return { left, right }
}

// spec: STATS-001.67, STATS-001.69
test(`renders the five highlights without overlap, the weekday bars with a height ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)

	await expect(highlights(page).locator('h4')).toHaveText(['Best day', 'Busiest weekday', 'Pace', 'Active days', 'Longest streak'])
	await expect(card(page, 'Best day')).toContainText('86')
	await expect(card(page, 'Busiest weekday')).toContainText('Tuesday')
	await expect(card(page, 'Pace')).toContainText('▼ 5.2 slower than')
	await expect(card(page, 'Active days')).toContainText('4 of 26')
	await expect(card(page, 'Longest streak')).toContainText('3 days')

	const cards = await highlights(page).locator('.statistics-highlights__cell').all()
	const boxes = await Promise.all(cards.map(box))
	boxes.forEach((first, index) => boxes.slice(index + 1).forEach((second) => {
		const apart = first.x + first.width <= second.x + 1 || second.x + second.width <= first.x + 1 || first.y + first.height <= second.y + 1 || second.y + second.height <= first.y + 1
		expect(apart, 'the highlight cards do not overlap').toBe(true)
	}))

	const days = card(page, 'Busiest weekday').locator('.statistics-highlights__week > div')
	await expect(days).toHaveCount(7)
	const top = await box(card(page, 'Busiest weekday').locator('.statistics-highlights__day--top i'))
	const monday = await box(days.first().locator('i'))
	expect(top.height).toBeGreaterThan(monday.height)
	expect(await highlights(page).locator('.statistics-highlights__value').first().evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums')
	await page.screenshot({ path: testInfo.outputPath('statistics-highlights.png'), fullPage: true, animations: 'disabled' })
})

// spec: STATS-001.68
test('Show day jumps from the best day to its week', async ({ page }) => {
	await openStatistics(page, ANSWER)

	await card(page, 'Best day').getByRole('button', { name: 'Show day' }).click()
	await expect(page.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(7)
	expect(await page.evaluate(() => window.location.hash)).toBe('#week')
	await expect(card(page, 'Best day')).toContainText('86')
	await expect(card(page, 'Best day').getByRole('button', { name: 'Show day' })).toHaveCount(0)
})

// spec: STATS-001.67
test('says that nothing was counted in a period without a counter', async ({ page }) => {
	await openStatistics(page, ANSWER, '#month=2026-09')

	await expect(highlights(page)).toContainText('Nothing counted in this period.')
	await expect(highlights(page).locator('.statistics-highlights__cell')).toHaveCount(0)
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.68
	test('keeps the Show day button a 44 px target inside the width', async ({ page }) => {
		await page.setViewportSize(PHONE)
		await openStatistics(page, ANSWER)

		await expectTouchTargets(card(page, 'Best day'), 'Show day on a phone')
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
	})
})

for (const { width, layout } of LAYOUTS) {
	// spec: STATS-001.67
	test(`lays the five highlights out as one card with ${layout === 'strip' ? 'a strip' : 'rows'} at ${width} px ${WEBKIT}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width, height: HEIGHT })
		await openStatistics(page, ANSWER)

		const card = await box(page.locator('.statistics-highlights__card'))
		const cells = await Promise.all((await page.locator('.statistics-highlights__cell').all()).map(box))
		expect(cells).toHaveLength(CELLS)
		cells.forEach((cell) => {
			expect(cell.x >= card.x - TOLERANCE_PX && cell.x + cell.width <= card.x + card.width + TOLERANCE_PX, 'a cell inside the card').toBe(true)
			expect(cell.y >= card.y - TOLERANCE_PX && cell.y + cell.height <= card.y + card.height + TOLERANCE_PX, 'a cell inside the card').toBe(true)
		})
		if (layout === 'strip') {
			cells.forEach((cell, index) => {
				expect(near(cell.y, cells[0]!.y), `cell ${index + 1} on the strip's line`).toBe(true)
				expect(near(cell.width, cells[0]!.width), `cell ${index + 1} as wide as the first`).toBe(true)
				if (index > 0) {
					expect(near(cell.x, cells[index - 1]!.x + cells[index - 1]!.width), `cell ${index + 1} next to the one before`).toBe(true)
				}
			})
		} else {
			cells.forEach((cell, index) => {
				expect(near(cell.x, cells[0]!.x) && near(cell.width, cells[0]!.width), `row ${index + 1} as wide as the first`).toBe(true)
				if (index > 0) {
					expect(near(cell.y, cells[index - 1]!.y + cells[index - 1]!.height), `row ${index + 1} under the one before`).toBe(true)
				}
			})
			for (const cell of await page.locator('.statistics-highlights__cell').all()) {
				const label = await cell.locator('h4').evaluate(textBox)
				const value = await cell.locator('.statistics-highlights__value').evaluate(textBox)
				const row = await box(cell)
				expect(near(label.left, row.x), 'the label at the row\'s start').toBe(true)
				expect(near(value.right, row.x + row.width), 'the value at the row\'s end').toBe(true)
			}
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
		await page.screenshot({ path: testInfo.outputPath(`statistics-highlights-${width}.png`), fullPage: true, animations: 'disabled' })
	})
}
