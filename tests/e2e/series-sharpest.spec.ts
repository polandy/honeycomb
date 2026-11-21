// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { cullFolder } from './cull.ts'
import { createFolder, upload, withCaptureTime } from './files.ts'

const DESKTOP = { width: 1440, height: 900 }
// One scene twice: a grain patch in the top left corner, blurred in the soft photo.
const SOFT = readFileSync('tests/fixtures/images/series-soft.jpg')
const SHARP = readFileSync('tests/fixtures/images/series-sharp.jpg')

// spec: SERIES-007.8
test('marks the sharp photo of a series, keeps the soft one active and zooms onto the sharp corner', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Sharpest ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(SOFT, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(SHARP, '2026:11:10 10:00:01'))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.keyboard.press('n')
	const compare = page.getByRole('dialog', { name: /^Compare series 1 of 1/ })
	const cards = compare.locator('.series-compare__card')
	await expect(cards.nth(1).locator('.sharpest-mark')).toHaveText('Sharpest')
	await expect(cards.nth(0).locator('.sharpest-mark')).toHaveCount(0)
	await expect(compare.getByRole('button', { name: 'Photo 1: IMG_0001' })).toHaveAttribute('aria-pressed', 'true')
	await expect(compare.locator('.flag-mark')).toHaveCount(0)

	await compare.getByRole('button', { name: 'View photo 2 full screen' }).click()
	const viewer = page.getByRole('dialog', { name: 'Series viewer' })
	await expect(viewer.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(viewer.locator('.series-viewer__title .sharpest-mark')).toHaveText('Sharpest')
	await page.keyboard.press('z')
	await expect(viewer.locator('.loupe-stage img[alt="IMG_0002"]')).toHaveAttribute('style', /translate\([1-9][\d.]*px, [1-9][\d.]*px\)/)
})

// spec: SERIES-008.7
test('reduces the series to its sharp photo from the More menu after the review', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Reduce ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(SOFT, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(SHARP, '2026:11:10 10:00:01'))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'More' }).click()
	const reduce = page.getByRole('button', { name: /^Reduce series to the sharpest… 1/ })
	await expect(reduce).toBeEnabled()
	await reduce.click()
	const dialog = page.getByRole('dialog', { name: 'Reduce series to the sharpest' })
	await expect(dialog.locator('.picture-thumbs__tile')).toHaveText(/IMG_0002/)
	await dialog.getByRole('button', { name: 'Pick 1, reject 1' }).click()

	await expect(dialog).toBeHidden()
	await expect(page.getByRole('gridcell')).toHaveCount(1)
	await expect(page.getByRole('gridcell')).toHaveAttribute('aria-label', /IMG_0002.*Picked/)
})
