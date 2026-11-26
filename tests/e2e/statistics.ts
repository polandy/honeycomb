// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

const STATISTICS_URL = '/index.php/apps/honeycomb/statistics'

/** Waits, up to the test's timeout, until every load of the statistics page has answered. */
export async function statisticsSettled(page: Page): Promise<void> {
	await page.locator('.statistics-page[data-settled]').waitFor()
}

/** Opens the statistics page at `hash` once it settled. */
export async function gotoStatistics(page: Page, hash = ''): Promise<void> {
	await page.goto(`${STATISTICS_URL}${hash}`)
	await statisticsSettled(page)
}

/** Opens the statistics page on `answer` instead of the server's counters. */
export async function openStatistics(page: Page, answer: object, hash = ''): Promise<void> {
	await page.goto('about:blank')
	await page.route('**/apps/honeycomb/api/v1/stats', (route) => (route.request().method() === 'GET' ? route.fulfill({ json: answer }) : route.continue()))
	await gotoStatistics(page, hash)
}
