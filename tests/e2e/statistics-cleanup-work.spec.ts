// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { openStatistics } from './statistics.ts'

const TOLERANCE_PX = 1
const HEIGHT = 900
const ROWS = 8
/** Counted since 14 March 2025, today Thursday 26 November 2026; October's numbers stay out of November's cards. */
const ANSWER = {
	counters: [
		{ day: '2026-10-05', metric: 'tags_set', value: 99 },
		{ day: '2026-11-24', metric: 'pictures_decided', value: 10 },
		{ day: '2026-11-24', metric: 'trash_pictures', value: 4 },
		{ day: '2026-11-24', metric: 'trash_bytes', value: 4_194_304 },
		{ day: '2026-11-24', metric: 'deleted_pictures', value: 1 },
		{ day: '2026-11-24', metric: 'deleted_bytes', value: 1_048_576 },
		{ day: '2026-11-24', metric: 'raws_removed', value: 3 },
		{ day: '2026-11-24', metric: 'raws_removed_bytes', value: 5_242_880 },
		{ day: '2026-11-24', metric: 'sidecars_created', value: 7 },
		{ day: '2026-11-24', metric: 'sidecars_updated', value: 3 },
		{ day: '2026-11-24', metric: 'sidecars_foreign', value: 2 },
		{ day: '2026-11-25', metric: 'ratings_set', value: 12 },
		{ day: '2026-11-25', metric: 'colour_labels_set', value: 4 },
		{ day: '2026-11-25', metric: 'tags_set', value: 10 },
		{ day: '2026-11-25', metric: 'series_done', value: 2 },
		{ day: '2026-11-25', metric: 'folders_done', value: 1 },
		{ day: '2026-11-25', metric: 'pictures_moved', value: 30 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}
/** Only pictures moved, in the one month nothing else was counted. */
const SPARSE = {
	...ANSWER,
	counters: [{ day: '2026-11-24', metric: 'pictures_moved', value: 5 }],
}

const cleanup = (page: Page) => page.locator('.statistics-cleanup')
const work = (page: Page) => page.locator('.statistics-work')
const calendar = (page: Page) => page.locator('.statistics-calendar')
const library = (page: Page) => page.locator('.statistics-library')
const box = async (locator: Locator) => (await locator.boundingBox())!
const near = (actual: number, expected: number) => Math.abs(actual - expected) <= TOLERANCE_PX
/** The name and value of each row of a card. */
const rows = (card: Locator) => card.locator('.statistics-rows__row').evaluateAll((all) => all.map((row) => [row.querySelector('.statistics-rows__name')!.textContent, row.querySelector('.statistics-rows__value')!.textContent]))

// spec: STATS-001.78
test('shows what the space freed is made of, as a bar of three painted parts and a row per part', async ({ page }) => {
	await page.setViewportSize({ width: 1180, height: HEIGHT })
	await openStatistics(page, ANSWER)

	await expect(cleanup(page).locator('.statistics-cleanup__freed')).toHaveText('10 MB freed')
	expect(await rows(cleanup(page))).toEqual([['Moved to the trash bin', '4 MB'], ['Deleted for good', '1 MB'], ['RAW files removed', '5 MB']])
	const widths = await cleanup(page).locator('.statistics-cleanup__split i').evaluateAll((parts) => parts.map((part) => part.getBoundingClientRect().width))
	const whole = (await box(cleanup(page).locator('.statistics-cleanup__split'))).width
	expect(widths.map((width) => Math.round(width / whole * 100))).toEqual([40, 10, 50])
	for (const part of ['trash', 'deleted', 'raws']) {
		const style = await cleanup(page).locator(`.statistics-cleanup__split .statistics-bars__part--${part}`).evaluate((each) => getComputedStyle(each).backgroundImage !== 'none' || getComputedStyle(each).backgroundColor !== 'rgba(0, 0, 0, 0)')
		expect(style).toBe(true)
	}
	await expect(cleanup(page)).toContainText('Space is freed when the trash bin is emptied.')
})

// spec: STATS-001.79
test('lists the work done of the month, hides the rows at zero and leaves October out', async ({ page }) => {
	await page.setViewportSize({ width: 1180, height: HEIGHT })
	await openStatistics(page, ANSWER)

	expect(await rows(work(page))).toHaveLength(ROWS)
	expect(await rows(work(page))).toEqual([['Sidecars created', '7'], ['Sidecars updated', '3'], ['Ratings set', '12'], ['Colour labels set', '4'], ['Tags set', '10'], ['Series done', '2'], ['Folders done', '1'], ['Photos moved', '30']])
	await expect(work(page)).toContainText('2 from digiKam or darktable')

	await openStatistics(page, SPARSE)
	expect(await rows(work(page))).toEqual([['Photos moved', '5']])
	await expect(cleanup(page)).toContainText('Nothing freed in this period.')
	await expect(cleanup(page).locator('.statistics-cleanup__split')).toHaveCount(0)
})

// spec: STATS-001.80
test('puts the calendar beside Clean-up and the library beside Work done from 880 px, stacked below', async ({ page }) => {
	await page.setViewportSize({ width: 1180, height: HEIGHT })
	await openStatistics(page, ANSWER)
	const [cal, clean, lib, done] = [await box(calendar(page)), await box(cleanup(page)), await box(library(page)), await box(work(page))]

	expect(near(cal.y, clean.y) && near(cal.height, clean.height)).toBe(true)
	expect(near(lib.y, done.y) && near(lib.height, done.height)).toBe(true)
	expect(near(cal.width, clean.width) && near(lib.width, done.width)).toBe(true)
	expect(clean.x - (cal.x + cal.width)).toBeGreaterThanOrEqual(TOLERANCE_PX)
	expect(lib.y).toBeGreaterThanOrEqual(cal.y + cal.height - TOLERANCE_PX)

	await page.setViewportSize({ width: 390, height: HEIGHT })
	const phone = [await box(calendar(page)), await box(cleanup(page)), await box(library(page)), await box(work(page))]
	phone.slice(1).forEach((each, index) => expect(each.y).toBeGreaterThanOrEqual(phone[index]!.y + phone[index]!.height - TOLERANCE_PX))
	phone.forEach((each) => expect(each.x + each.width).toBeLessThanOrEqual(390 + TOLERANCE_PX))
})
