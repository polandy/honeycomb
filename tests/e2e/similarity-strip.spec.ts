// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page, Route } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const PREVIEWS = '**/api/v1/images/**'
const WIDTHS = { phone: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } }

/** Culls a new folder of two alike JPEGs shot a second apart, a series while their hashes are pending. */
async function cullBurst(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Strip ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:14 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:14 10:00:01'))
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
}

for (const [width, viewport] of Object.entries(WIDTHS)) {
	// spec: SERIES-003.18, SERIES-003.20, SERIES-003.25
	test(`lays the similarity over the grid while hashing and says when the photos are compared, ${width}`, async ({ page }) => {
		await page.setViewportSize(viewport)
		const held: Route[] = []
		let released = false
		await page.route(PREVIEWS, (route) => (released ? route.continue() : held.push(route)))
		await cullBurst(page)
		const strip = page.locator('.similarity-strip')
		const firstTile = page.getByRole('gridcell').first()

		await expect(strip.getByRole('progressbar', { name: 'Similarity' })).toBeVisible()
		await expect(strip).toContainText('Comparing photos 0/2')
		await expect(page.locator('.grid-toolbar').getByRole('progressbar', { name: 'Similarity' })).toHaveCount(0)
		await expect(firstTile).toHaveAccessibleName(/Series of 2, Series may still change/)
		await expect(page.locator('.photo-tile__series--open')).toHaveCount(2)
		const before = await firstTile.boundingBox()
		const band = (await strip.boundingBox())!
		expect(before!.y).toBeGreaterThanOrEqual(band.y + band.height)

		released = true
		await Promise.all(held.map((route) => route.continue()))
		await expect(strip).toContainText('Photos compared')
		await expect(strip).toBeHidden()
		expect(await firstTile.boundingBox()).toEqual(before)
		await expect(page.locator('.photo-tile__series--open')).toHaveCount(0)
		await expect(firstTile).toHaveAccessibleName(/Series of 2$/)
	})

	// spec: SERIES-003.19
	test(`keeps the strip with the photos not compared, ${width}`, async ({ page }) => {
		await page.setViewportSize(viewport)
		await page.route(PREVIEWS, (route) => route.fulfill({ status: 404 }))
		await cullBurst(page)

		await expect(page.locator('.similarity-strip--failed')).toHaveText('Similarity: 2 photos not compared')
	})
}
