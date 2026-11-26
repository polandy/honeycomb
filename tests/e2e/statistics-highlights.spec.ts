// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }

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
const card = (page: Page, title: string) => highlights(page).locator('.statistics-highlights__card', { has: page.getByRole('heading', { name: title }) })
const box = async (locator: Locator) => (await locator.boundingBox())!

// spec: STATS-001.67, STATS-001.69
test(`renders the five highlights without overlap, the weekday bars with a height ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page, ANSWER)

	await expect(highlights(page).locator('h3')).toHaveText(['Best day', 'Busiest weekday', 'Pace', 'Active days', 'Longest streak'])
	await expect(card(page, 'Best day')).toContainText('86')
	await expect(card(page, 'Busiest weekday')).toContainText('Tuesday')
	await expect(card(page, 'Pace')).toContainText('▼ 5.2 slower than')
	await expect(card(page, 'Active days')).toContainText('4 of 26')
	await expect(card(page, 'Longest streak')).toContainText('3 days')

	const cards = await highlights(page).locator('.statistics-highlights__card').all()
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

	await expect(highlights(page)).toHaveText('Nothing counted in this period.')
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
