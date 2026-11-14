// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const PHONE = { width: 320, height: 640 }
const DESKTOP = { width: 1440, height: 900 }

// spec: SERIES-001.13
test('shows the whole label of Pick this, reject the rest in the bottom bar of a phone', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Series ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.keyboard.press('n')

	const button = page.getByRole('dialog', { name: 'Compare series 1 of 1' }).getByRole('button', { name: 'Pick this, reject the rest' })
	await expect(button).toBeInViewport({ ratio: 1 })
	const label = button.locator('.button-vue__text')
	expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})

// spec: SERIES-001.20
test('fills the screen with the compare and keeps the flag buttons level beside a flagged card', async ({ page }) => {
	await page.setViewportSize(DESKTOP)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Series ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.keyboard.press('n')
	const dialog = page.getByRole('dialog', { name: 'Compare series 1 of 1' })
	await page.keyboard.press('p')
	await expect(dialog.locator('.flag-mark--picked')).toHaveCount(1)

	const tops = async (selector: string) => dialog.locator(selector).evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().top)))
	expect(new Set(await tops('.flag-buttons')).size).toBe(1)
	await expect(dialog.locator('.pick-rest-button')).toHaveCount(1)
	const photo = await dialog.locator('.series-compare__photo img').first().boundingBox()
	expect(photo!.width).toBeGreaterThanOrEqual(DESKTOP.width * 0.4)
	const container = await page.locator('.series-compare-dialog .modal-container').boundingBox()
	expect(container!.width).toBe(DESKTOP.width)
	expect(container!.y + container!.height).toBe(DESKTOP.height)
})

// spec: SERIES-001.4, SERIES-001.21
test('shows a whole burst as one series in a grid that scrolls down to the active card', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Series ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const second of [0, 1, 2, 3, 4, 5]) {
		await upload(page, `${folder}/IMG_000${second}.jpg`, withCaptureTime(JPEG, `2026:11:10 10:00:0${second}`))
	}

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell').first()).toBeVisible()
	await page.keyboard.press('n')
	const dialog = page.getByRole('dialog', { name: 'Compare series 1 of 1' })
	const cards = dialog.locator('.series-compare__card')
	await expect(cards).toHaveCount(6)

	const grid = dialog.locator('.series-compare')
	expect(await grid.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
	const columns = new Set(await cards.evaluateAll((elements) => elements.map((element) => Math.round(element.getBoundingClientRect().left)))).size
	await expect(cards.last()).not.toBeInViewport()
	for (const _ of [1, 2, 3, 4, 5]) {
		await page.keyboard.press('ArrowRight')
	}
	await expect(cards.last().locator('.series-compare__photo')).toHaveAttribute('aria-pressed', 'true')
	await expect(cards.last()).toBeInViewport()
	await page.keyboard.press('ArrowUp')
	await expect(cards.nth(5 - columns).locator('.series-compare__photo')).toHaveAttribute('aria-pressed', 'true')
})
