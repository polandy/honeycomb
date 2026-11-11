// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page, TestInfo } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, RAW, upload, withCaptureTime } from './files.ts'

const IPAD_LANDSCAPE = { width: 1180, height: 820 }
const IPAD_PORTRAIT = { width: 820, height: 1180 }
/** EXIF orientation: turn 90° clockwise to show upright. */
const ROTATE_CW = 6
const ASPECT_TOLERANCE = 0.02

/** How many stage images are visible and reach into both the stage and the viewport. */
function photosInView(page: Page) {
	return page.evaluate(() => {
		const stage = document.querySelector('.loupe-stage')!.getBoundingClientRect()
		return [...document.querySelectorAll('.loupe-stage img')].filter((image) => {
			const box = image.getBoundingClientRect()
			const width = Math.min(box.right, stage.right, window.innerWidth) - Math.max(box.left, stage.left, 0)
			const height = Math.min(box.bottom, stage.bottom, window.innerHeight) - Math.max(box.top, stage.top, 0)
			return width > 0 && height > 0 && image.checkVisibility({ visibilityProperty: true, opacityProperty: true })
		}).length
	})
}

/** Culls _MG_1030, the EXIF-rotated _MG_1031 JPG+CR2 pair and _MG_1032, and opens the pair in the loupe. */
async function openRotatedPair(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Rotated ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/_MG_1030.jpg`, withCaptureTime(JPEG, '2026:11:10 12:00:00'))
	await upload(page, `${folder}/_MG_1031.JPG`, withCaptureTime(JPEG, '2026:11:10 12:00:01', ROTATE_CW))
	await upload(page, `${folder}/_MG_1031.CR2`, RAW)
	await upload(page, `${folder}/_MG_1032.jpg`, withCaptureTime(JPEG, '2026:11:10 12:00:02'))

	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: /^_MG_1031, JPG\+CR2/ }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	const guide = loupe.getByRole('dialog', { name: 'How to cull' })
	await guide.getByRole('button', { name: 'Got it' }).click()
	await expect(guide).toBeHidden()
	return loupe
}

/** Asserts the rotated photo alone is in view, upright and undistorted, and keeps a screenshot. */
async function expectRotatedAlone(page: Page, loupe: Locator, testInfo: TestInfo, shot: string) {
	const photo = loupe.getByRole('img', { name: '_MG_1031' })
	await expect(photo).toHaveJSProperty('complete', true)
	await expect.poll(() => photosInView(page)).toBe(1)
	const box = (await photo.boundingBox())!
	const natural = await photo.evaluate((image: HTMLImageElement) => image.naturalWidth / image.naturalHeight)
	expect(box.height).toBeGreaterThan(box.width)
	expect(Math.abs(box.width / box.height - natural)).toBeLessThan(ASPECT_TOLERANCE)
	await page.screenshot({ path: testInfo.outputPath(shot) })
}

// spec: LOUPE-001.18
test('shows only the rotated pair, upright, at iPad landscape and portrait', async ({ page }, testInfo) => {
	await page.setViewportSize(IPAD_LANDSCAPE)
	const loupe = await openRotatedPair(page)
	await expectRotatedAlone(page, loupe, testInfo, 'loupe-ipad-landscape.png')

	await page.setViewportSize(IPAD_PORTRAIT)
	await expectRotatedAlone(page, loupe, testInfo, 'loupe-ipad-portrait.png')

	await page.keyboard.press('ArrowRight')
	await expect(loupe.getByRole('heading', { name: '_MG_1032' })).toBeVisible()
	await expect.poll(() => photosInView(page)).toBe(1)
})

// spec: LOUPE-001.18
test('shows only the rotated pair, upright, in browser fullscreen', async ({ page }, testInfo) => {
	await page.setViewportSize(IPAD_LANDSCAPE)
	const loupe = await openRotatedPair(page)

	await page.keyboard.press('f')
	await expect.poll(() => page.evaluate(() => document.fullscreenElement !== null)).toBe(true)
	await expectRotatedAlone(page, loupe, testInfo, 'loupe-fullscreen.png')

	await page.keyboard.press('ArrowLeft')
	await expect(loupe.getByRole('heading', { name: '_MG_1030' })).toBeVisible()
	await expect.poll(() => photosInView(page)).toBe(1)
})
