// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { openStatistics } from './statistics.ts'
import { expectTouchTargets } from './touch-targets.ts'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1180, height: 900 }
const TOLERANCE_PX = 1
const GB = 1024 ** 3
const SERVER_ERROR = 500

/** Counted since 1 November 2026, today Thursday 26 November 2026: 260 decided in 26 days. */
const ANSWER = {
	counters: [{ day: '2026-11-02', metric: 'pictures_decided', value: 200 }, { day: '2026-11-24', metric: 'pictures_decided', value: 60 }],
	firstDay: '2026-11-01',
	today: '2026-11-26',
	seriesDoneBefore: 0,
	read: { pictures: 0, picked: 0, rejected: 0, rated: 0 },
}

/** A library folder with 100 photos, done on 10 November with 2 GB of RAW files, or 70 undecided. */
function libraryFolder(fileId: number, done: boolean, shotDays: readonly { day: string, photos: number }[] = []) {
	return {
		fileId,
		root: '/Photos',
		path: `/Photos/${fileId}`,
		photos: 100,
		bytes: 900_000_000,
		rawBytes: 2 * GB,
		picked: done ? 60 : 20,
		rejected: done ? 40 : 10,
		undecided: done ? 0 : 70,
		bursts: 0,
		oldest: null,
		newest: null,
		lastActivity: null,
		previews: [],
		shotDays,
		permissions: 31,
		done: done ? { by: 'admin', at: Date.UTC(2026, 10, 10) / 1000, photos: 100 } : null,
	}
}

const FOLDERS = [libraryFolder(1, true), libraryFolder(2, false), libraryFolder(3, false)]
const library = (page: Page) => page.locator('.statistics-library')

/** Opens the statistics page with `/Photos` as the library root and `folders` as its folders, or a failed read. */
async function openWithLibrary(page: Page, folders: readonly object[] | null): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	await page.route('**/apps/honeycomb/api/v1/library/folders*', (route) => (folders === null
		? route.fulfill({ status: SERVER_ERROR, json: { error: 'down' } })
		: route.fulfill({ json: { folders, nextCursor: null, scanning: null } })))
	await putSettings(page, { ...E2E_SETTINGS, libraryRoots: ['/Photos'] })
	await openStatistics(page, ANSWER)
}

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: STATS-001.42, STATS-001.84, STATS-001.85
test('rings the done share and lists the facts, the forecast and the RAW space beside it', async ({ page }, testInfo) => {
	await page.setViewportSize(DESKTOP)
	await openWithLibrary(page, FOLDERS)

	const ring = library(page).locator('.statistics-library__ring')
	await expect(ring).toHaveAttribute('aria-label', '33% of the photos are in folders marked done')
	await expect(ring).toHaveText(/33%\s*done/)
	const arc = (await library(page).locator('.statistics-library__arc').boundingBox())!
	expect(arc.width).toBeGreaterThan(0)
	expect(await library(page).locator('.statistics-library__arc').evaluate((each) => getComputedStyle(each).stroke)).not.toBe('none')
	await expect(library(page).locator('.statistics-library__fact')).toHaveText([/53%\s*of the photos decided/, /1 \/ 3\s*folders done · \+1 this month/, /140\s*photos still undecided/, /About 2 weeks\s*at your pace \(last 90 days\)/])
	expect(await library(page).locator('.statistics-library__fact b').first().evaluate((each) => getComputedStyle(each).fontVariantNumeric)).toContain('tabular-nums')
	const facts = (await library(page).locator('.statistics-library__facts').boundingBox())!
	const ringBox = (await ring.boundingBox())!
	expect(facts.x).toBeGreaterThanOrEqual(ringBox.x + ringBox.width - TOLERANCE_PX)
	await expect(library(page).locator('.statistics-library__raws')).toHaveText('Up to 2 GB of RAW files lie in folders marked done.')
	await library(page).screenshot({ path: testInfo.outputPath('statistics-library.png'), animations: 'disabled' })

	await library(page).getByRole('link', { name: 'Open Folders' }).click()
	await expect(page).toHaveURL(/\/apps\/honeycomb\/$/)
})

// spec: STATS-001.84
test('says the backlog grows when more photos were added than decided in the last 90 days', async ({ page }) => {
	await openWithLibrary(page, [libraryFolder(1, true), libraryFolder(2, false, [{ day: '2026-11-20', photos: 400 }])])

	await expect(library(page).locator('.statistics-library__forecast')).toHaveText(/At this pace the backlog grows/)
	await expect(library(page)).not.toContainText('About')
})

// spec: STATS-001.50
test('asks to choose the library without roots, with no ring', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await putSettings(page, E2E_SETTINGS)
	await openStatistics(page, ANSWER)

	await expect(library(page)).toContainText('Choose your library')
	await expect(library(page).locator('.statistics-library__ring')).toHaveCount(0)
	await expect(library(page).getByRole('link', { name: 'Open Folders' })).toBeVisible()
})

// spec: STATS-001.51
test('says only inside the card that the library progress could not be loaded', async ({ page }) => {
	await openWithLibrary(page, null)

	await expect(library(page)).toHaveText(/The library progress could not be loaded\./)
	await expect(library(page).locator('.statistics-library__ring')).toHaveCount(0)
	await expect(page.locator('.statistics-hero')).toContainText('260')
	await expect(page.locator('.statistics-work')).toBeVisible()
	await expect(page.getByText('The library progress could not be loaded.')).toHaveCount(1)
	await expect(page.getByText('The statistics could not be loaded.')).toHaveCount(0)
})

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.42, STATS-001.85
	test('fits the ring, the facts and the RAW line into the width of a phone', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		await openWithLibrary(page, FOLDERS)

		await expect(library(page).locator('.statistics-library__ring')).toBeVisible()
		await expectTouchTargets(library(page), 'library card on a phone')
		const card = (await library(page).boundingBox())!
		expect(card.x + card.width).toBeLessThanOrEqual(PHONE.width + TOLERANCE_PX)
		expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(PHONE.width)
		await page.screenshot({ path: testInfo.outputPath('statistics-library-phone.png'), fullPage: true, animations: 'disabled' })
	})
})
