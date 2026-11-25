// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** An answer of the statistics API counted since 14 March 2025 with today on Thursday 26 November 2026 and nothing in October 2026. */
const ANSWER = {
	counters: [
		{ day: '2025-03-14', metric: 'pictures_decided', value: 30 },
		{ day: '2025-08-02', metric: 'pictures_decided', value: 80 },
		{ day: '2026-09-15', metric: 'pictures_decided', value: 50 },
		{ day: '2026-11-02', metric: 'pictures_decided', value: 40 },
		{ day: '2026-11-02', metric: 'trash_pictures', value: 10 },
		{ day: '2026-11-25', metric: 'pictures_decided', value: 60 },
		{ day: '2026-11-26', metric: 'pictures_decided', value: 20 },
	],
	firstDay: '2025-03-14',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** Opens the statistics page on the stubbed counters. */
async function openStatistics(page: Page): Promise<void> {
	await page.route('**/apps/honeycomb/api/v1/stats', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: ANSWER }) : route.continue()))
	await page.goto('/index.php/apps/honeycomb/statistics')
	await expect(page.locator('.statistics-page__label')).toBeVisible()
}

/** The texts under the bars, one per bar. */
const barLabels = (page: Page) => page.locator('.statistics-bars__label').allTextContents()

/** Expects two boxes side by side or stacked, never on top of each other. */
async function expectApart(first: Locator, second: Locator): Promise<void> {
	const a = (await first.boundingBox())!
	const b = (await second.boundingBox())!
	const apart = a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y
	expect(apart, `${JSON.stringify(a)} overlaps ${JSON.stringify(b)}`).toBe(true)
}

/** Expects the page's controls of the period to sit apart and the chart to draw today's decided column. */
async function expectDrawn(page: Page): Promise<void> {
	await expectApart(page.getByRole('group', { name: 'Period' }), page.locator('.statistics-page__label'))
	await expectApart(page.getByRole('button', { name: 'Previous period' }), page.locator('.statistics-page__label'))
	await expectApart(page.locator('.statistics-page__label'), page.getByRole('button', { name: 'Next period' }))
	const today = page.locator('.statistics-bars__bar--today')
	await expect(today).toHaveCount(1)
	expect((await today.locator('.statistics-bars__decided').boundingBox())!.height).toBeGreaterThan(0)
	expect(await today.locator('.statistics-bars__columns').evaluate((element) => getComputedStyle(element).outlineStyle)).not.toBe('none')
}

// spec: STATS-001.21, STATS-001.52, STATS-001.53, STATS-001.54, STATS-001.55
test(`steps through the calendar periods on the desktop and the iPad ${WEBKIT}`, async ({ page }, testInfo) => {
	await openStatistics(page)

	await expect(page.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.statistics-page__label')).toHaveText('November 2026')
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(30)
	expect(await barLabels(page)).toEqual(expect.arrayContaining(['1', '8', '15', '22', '29']))
	await expect(page.locator('.statistics-bars__bar--future')).toHaveCount(4)
	expect(await page.locator('.statistics-bars__bar--future .statistics-bars__columns').first().evaluate((element) => getComputedStyle(element).backgroundImage)).toContain('repeating-linear-gradient')
	await expect(page.getByRole('button', { name: 'Next period' })).toBeDisabled()
	await expect(page.getByRole('button', { name: 'Today' })).toBeDisabled()
	await expectDrawn(page)
	await page.screenshot({ path: testInfo.outputPath('statistics-month.png'), fullPage: true, animations: 'disabled' })

	await page.getByRole('button', { name: 'Previous period' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('October 2026')
	await expect(page.getByText('Nothing counted in this period.')).toBeVisible()
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(0)
	await expect(page.getByRole('button', { name: 'Next period' })).toBeEnabled()
	await page.getByRole('button', { name: 'Today' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('November 2026')

	await page.getByRole('button', { name: 'Week' }).click()
	const firstWeekDay = await page.evaluate(() => (globalThis as { firstDay?: number }).firstDay ?? 0)
	await expect(page.locator('.statistics-bars__bar')).toHaveCount(7)
	expect(await barLabels(page)).toEqual([...WEEKDAYS.slice(firstWeekDay), ...WEEKDAYS.slice(0, firstWeekDay)])
	await expect(page.locator('.delete-stats__item', { hasText: 'Photos decided' })).toContainText('80')

	await page.getByRole('button', { name: 'Year' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('2026')
	expect(await barLabels(page)).toEqual(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
	await expect(page.locator('.statistics-bars__bar--future')).toHaveCount(1)
	await page.getByRole('button', { name: 'Previous period' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('2025')
	await page.getByRole('button', { name: 'Month' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('March 2025')
	await expect(page.getByRole('button', { name: 'Previous period' })).toBeDisabled()
	await expect(page.locator('.statistics-bars__bar--before-first')).toHaveCount(13)
	await expect(page.locator('.statistics-bars__bar--future')).toHaveCount(0)

	await page.getByRole('button', { name: 'All time' }).click()
	await expect(page.locator('.statistics-page__label')).toHaveText('Since Mar 14, 2025')
	await expect(page.getByRole('button', { name: 'Previous period' })).toHaveCount(0)
	expect(await barLabels(page)).toEqual(['2025', '2026'])
	await page.screenshot({ path: testInfo.outputPath('statistics-all-time.png'), fullPage: true, animations: 'disabled' })
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.21, STATS-001.52, STATS-001.54
	test('fits the segment, the stepper and the bars of a month into the width of a phone', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await openStatistics(page)

		await expectTouchTargets(page.getByRole('group', { name: 'Period' }), 'statistics period segment on a phone')
		await expectTouchTargets(page.locator('.statistics-page__stepper'), 'statistics period stepper on a phone')
		await expectDrawn(page)
		await page.getByRole('button', { name: 'Year' }).click()
		await expect(page.locator('.statistics-bars__bar')).toHaveCount(12)
		const labels = page.locator('.statistics-bars__label')
		for (let index = 1; index < 12; index++) {
			await expectApart(labels.nth(index - 1), labels.nth(index))
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-periods-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
