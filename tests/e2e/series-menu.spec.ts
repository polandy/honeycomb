// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

/** Pixel 9 Pro in portrait. */
const PHONE = { width: 410, height: 914 }
const DESKTOP = { width: 1440, height: 900 }

/** A burst of three photos a second apart, and two loose photos hours later. */
const PHOTOS = [['IMG_0001', '10:00:01'], ['IMG_0002', '10:00:02'], ['IMG_0003', '10:00:03'], ['IMG_0004', '13:00:00'], ['IMG_0005', '16:00:00']] as const

/** Culls a new folder of the photos. */
async function cullPhotos(page: Page): Promise<string> {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Series menu ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [name, time] of PHOTOS) {
		await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(PHOTOS.length)
	return folder
}

/** Selects the photos in a fresh selection, opens *Series…* and checks its heading. */
async function openMenu(page: Page, names: readonly string[], caption: string): Promise<void> {
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	for (const name of names) {
		await page.getByRole('gridcell', { name: new RegExp(`^${name}`) }).click()
	}
	await page.getByRole('button', { name: 'Series…', exact: true }).click()
	await expect(page.getByText(caption, { exact: true })).toBeVisible()
}

/** Chooses an entry of the open menu and waits for its toast. */
async function choose(page: Page, entry: RegExp, toast: string): Promise<void> {
	await page.getByRole('menuitem', { name: entry }).click()
	await expect(page.getByText(toast)).toBeVisible()
	await page.getByRole('button', { name: 'Done' }).click()
}

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: SERIES-005.4, SERIES-005.6
	test('makes a new series of loose photos and adds a photo to it from the grid, kept after a reload', async ({ page }) => {
		await page.setViewportSize(PHONE)
		const folder = await cullPhotos(page)

		await openMenu(page, ['IMG_0004'], '1 photo, none in a series')
		await expect(page.getByRole('menuitem', { name: /New series from 1 photo/ })).toBeDisabled()
		await page.keyboard.press('Escape')
		await page.getByRole('gridcell', { name: /^IMG_0005/ }).click()
		await page.getByRole('button', { name: 'Series…', exact: true }).click()
		await choose(page, /New series from 2 photos/, 'Made a series of 2 photos')

		await page.reload()
		await cullFolder(page, folder)
		await openMenu(page, ['IMG_0004'], '1 photo in series ⧉ 2')
		await page.keyboard.press('Escape')
		await page.getByRole('gridcell', { name: /^IMG_0003/ }).click()
		await page.getByRole('button', { name: 'Series…', exact: true }).click()
		await expect(page.getByRole('menuitem', { name: /Merge 2 series · 5 photos/ })).toBeVisible()
	})
})

// spec: SERIES-005.7, SERIES-005.11
test('merges two series and removes a photo from its series on a desktop, kept after a reload', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	const folder = await cullPhotos(page)

	await openMenu(page, ['IMG_0004', 'IMG_0005'], '2 photos, none in a series')
	await choose(page, /New series from 2 photos/, 'Made a series of 2 photos')
	await openMenu(page, ['IMG_0001', 'IMG_0004'], '2 photos in 2 series')
	await choose(page, /Merge 2 series · 5 photos/, 'Merged 2 series · 5 photos')
	await openMenu(page, ['IMG_0002'], '1 photo in series ⧉ 5')
	await choose(page, /Remove 1 photo from its series/, 'Removed IMG_0002 from the series')

	await page.reload()
	await cullFolder(page, folder)
	await openMenu(page, ['IMG_0001', 'IMG_0002'], '1 photo in series ⧉ 4 · 1 loose')
})

// spec: SERIES-005.14, SERIES-005.15
test('marks a series done from the compare\'s menu, its photos counted as decided after a reload, and reopens it', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	const folder = await cullPhotos(page)
	const progress = page.locator('.cull-progress__count')

	await page.keyboard.press('n')
	await page.getByRole('button', { name: 'Series menu', exact: true }).click()
	await page.getByRole('menuitemcheckbox', { name: /Series done/, checked: false }).click()
	await expect(page.getByText('Marked the series done')).toBeVisible()
	await expect(progress).toHaveText('3 / 5 decided')

	await page.reload()
	await cullFolder(page, folder)
	await expect(progress).toHaveText('3 / 5 decided')
	await page.getByRole('gridcell', { name: /^IMG_0001/ }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('button', { name: 'Photo 1 of a series of 3 – compare' }).click()
	await page.getByRole('button', { name: 'Series menu', exact: true }).click()
	await page.getByRole('menuitemcheckbox', { name: /Series done/, checked: true }).click()
	await expect(page.getByText('Reopened the series')).toBeVisible()
	await page.keyboard.press('Escape')
	await page.keyboard.press('Escape')
	await expect(progress).toHaveText('0 / 5 decided')
})
