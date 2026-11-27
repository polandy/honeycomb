// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

const PHONE = { width: 390, height: 844 }

/** Counted since Tuesday 24 November 2026, today Thursday 26 November 2026. */
const ANSWER = {
	counters: [
		{ day: '2026-11-24', metric: 'pictures_decided', value: 10 },
		{ day: '2026-11-24', metric: 'pictures_picked', value: 6 },
		{ day: '2026-11-24', metric: 'pictures_rejected', value: 4 },
		{ day: '2026-11-24', metric: 'trash_pictures', value: 3 },
		{ day: '2026-11-24', metric: 'deleted_pictures', value: 1 },
	],
	firstDay: '2026-11-24',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** A library folder with 9 photos, shot on the given days. */
function libraryFolder(fileId: number, shotDays: readonly { day: string, photos: number }[]) {
	return { fileId, root: '/Photos', path: `/Photos/${fileId}`, photos: 9, bytes: 9_000_000, rawBytes: 0, picked: 0, rejected: 0, undecided: 9, bursts: 0, oldest: null, newest: null, lastActivity: null, previews: [], shotDays, permissions: 31, done: null }
}

/** 6 photos added on 20 November, before counting began, and 12 on 25 November, which counted nothing. */
const FOLDERS = [libraryFolder(11, [{ day: '2026-11-20', photos: 6 }, { day: '2026-11-25', photos: 4 }]), libraryFolder(12, [{ day: '2026-11-25', photos: 8 }])]

const bar = (page: Page, name: string) => page.locator(`.statistics-bars__columns[aria-label^="${name}:"]`)
const detail = (page: Page) => page.locator('.statistics-bars .statistics-bars__detail')
const intake = (page: Page) => page.locator('.statistics-bars__intake')

/** Opens November 2026 of the statistics page with the library folders above. */
async function openWithLibrary(page: Page): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	await page.route('**/apps/honeycomb/api/v1/library/folders*', (route) => route.fulfill({ json: { folders: FOLDERS, nextCursor: null, scanning: null } }))
	await putSettings(page, { ...E2E_SETTINGS, libraryRoots: ['/Photos'] })
	await openStatistics(page, ANSWER)
}

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: STATS-001.81, STATS-001.83
test(`sets the period's photos added against its pictures decided and deleted ${WEBKIT}`, async ({ page }) => {
	await openWithLibrary(page)

	await expect(intake(page)).toHaveText('Added 18 · Decided 10 · Deleted 4')
	expect(await intake(page).evaluate((element) => getComputedStyle(element).fontVariantNumeric)).toContain('tabular-nums')
})

// spec: STATS-001.82
test(`shows photos added in the chart and a held bar's photos added in the panel ${WEBKIT}`, async ({ page }, testInfo) => {
	await openWithLibrary(page)

	await page.getByRole('button', { name: 'Added', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Added', exact: true })).toHaveAttribute('aria-pressed', 'true')
	await expect(page.locator('.statistics-bars h3')).toHaveText('Photos added per day')
	await expect(page.locator('.statistics-bars__legend')).toContainText('Photos added')
	const wednesday = bar(page, 'Wed, Nov 25, 2026')
	const friday = bar(page, 'Fri, Nov 20, 2026')
	await expect(wednesday).toHaveAttribute('aria-label', 'Wed, Nov 25, 2026: 12 photos added')
	await expect(friday).toHaveAttribute('aria-label', 'Fri, Nov 20, 2026: 6 photos added')
	const high = (await wednesday.locator('.statistics-bars__part--added').boundingBox())!
	const low = (await friday.locator('.statistics-bars__part--added').boundingBox())!
	expect(low.height / high.height).toBeCloseTo(6 / 12, 1)
	await page.locator('.statistics-bars').screenshot({ path: testInfo.outputPath('statistics-added.png'), animations: 'disabled' })

	await wednesday.click()
	await expect(detail(page)).toContainText('Nothing counted.')
	await expect(detail(page)).toContainText('12 added')
	await friday.click()
	await expect(detail(page)).toContainText('Before counting began.')
	await expect(detail(page)).toContainText('6 added')
	await bar(page, 'Tue, Nov 24, 2026').click()
	await expect(detail(page)).toContainText('10 decided (✓ 6 · ✕ 4)')
	await expect(detail(page)).not.toContainText('added')
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.82, STATS-001.83
	test('fits the four chart choices and the intake line into the width of a phone', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await openWithLibrary(page)

		await expectTouchTargets(page.getByRole('group', { name: 'Chart shows' }), 'chart switch on a phone')
		await expect(page.getByRole('group', { name: 'Chart shows' }).getByRole('button')).toHaveCount(4)
		await expect(intake(page)).toBeVisible()
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-added-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
