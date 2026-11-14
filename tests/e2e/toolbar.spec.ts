// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page, Route } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1280, height: 800 }
/** Controls whose centres lie closer than this share a row. */
const ROW_TOLERANCE_PX = 12

/** Culls a new folder of two JPEGs. */
async function cullTwo(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Toolbar ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
}

/** How many rows the toolbar's visible controls take. */
async function toolbarRows(page: Page): Promise<number> {
	return page.locator('.grid-toolbar').evaluate((toolbar, tolerance) => {
		const centres = [...toolbar.querySelectorAll('button, .cull-progress__count, .progress-bar, .similarity-progress')]
			.map((element) => element.getBoundingClientRect())
			.filter((box) => box.width > 0 && box.height > 0)
			.map((box) => box.top + box.height / 2)
			.sort((a, b) => a - b)
		return centres.filter((centre, i) => i === 0 || centre - centres[i - 1]! > tolerance).length
	}, ROW_TOLERANCE_PX)
}

// spec: GRID-001.17
test('takes at most two rows on a phone, with Review rejects and Compare series in the More menu', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await cullTwo(page)

	expect(await toolbarRows(page)).toBeLessThanOrEqual(2)
	await expect(page.getByRole('button', { name: 'Review rejects' })).toBeHidden()
	await expect(page.getByRole('button', { name: 'Compare series' })).toBeHidden()
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Review rejects 0' })).toBeDisabled()
	await expect(page.getByRole('button', { name: /^Compare series \d/ })).toBeVisible()
})

// spec: GRID-001.17
test('keeps Review rejects and Compare series in the toolbar on a desktop', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await cullTwo(page)

	await expect(page.getByRole('button', { name: 'Review rejects' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Compare series' })).toBeVisible()
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await expect(page.getByRole('button', { name: 'Remove RAWs… 0' })).toBeVisible()
	await expect(page.getByRole('button', { name: /^Review rejects \d/ })).toBeHidden()
})

// spec: GRID-001.18
test('closes the More menu when an item opens the settings dialog', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await cullTwo(page)

	await page.getByRole('button', { name: 'More', exact: true }).click()
	const size = page.getByRole('slider', { name: 'Thumbnail size' })
	await expect(size).toBeVisible()
	await page.getByRole('button', { name: 'Settings', exact: true }).click()

	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
	await expect(size).toBeHidden()
})

const PREVIEWS = '**/api/v1/images/**'

// spec: SERIES-003.18
test('keeps two rows on a phone while the similarity is hashing', async ({ page }) => {
	await page.setViewportSize(PHONE)
	const held: Route[] = []
	await page.route(PREVIEWS, (route) => {
		held.push(route)
	})
	await cullTwo(page)

	await expect(page.getByRole('progressbar', { name: 'Similarity' })).toBeVisible()
	await expect(page.locator('.similarity-progress__text')).toHaveText('Similarity 0/2')
	expect(await toolbarRows(page)).toBeLessThanOrEqual(2)
	await Promise.all(held.map((route) => route.continue()))
})

// spec: SERIES-003.19
test('keeps two rows on a phone with the photos not compared', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.route(PREVIEWS, (route) => route.fulfill({ status: 404 }))
	await cullTwo(page)

	await expect(page.locator('.similarity-progress__short')).toHaveText('⚠ 2')
	await expect(page.locator('.similarity-progress__text')).toHaveText('Similarity: 2 photos not compared')
	expect(await toolbarRows(page)).toBeLessThanOrEqual(2)
})
