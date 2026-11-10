// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

/** Whether the middle of Nextcloud's header is on top, not under the loupe. */
function headerUncovered(page: Page) {
	return page.evaluate(() => {
		const header = document.getElementById('header')!.getBoundingClientRect()
		return document.elementFromPoint(header.x + header.width / 2, header.y + header.height / 2)?.closest('#header') !== null
	})
}

/** Culls a new folder of IMG_0001 and IMG_0002, opens IMG_0001 in the loupe and dismisses the guide. */
async function openLoupe(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Loupe ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()

	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(loupe.getByText('1 of 2')).toBeVisible()
	await expect(loupe.getByRole('img', { name: 'IMG_0001' })).toHaveJSProperty('complete', true)

	const guide = loupe.getByRole('dialog', { name: 'How to cull' })
	await guide.getByRole('button', { name: 'Got it' }).click()
	await expect(guide).toBeHidden()
	return loupe
}

// spec: LOUPE-001.2, LOUPE-001.3
test('opens a photo in the loupe, pages by key and closes back to the grid', async ({ page }) => {
	const loupe = await openLoupe(page)

	await page.keyboard.press('ArrowRight')
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 2')).toBeVisible()

	await expect.poll(() => headerUncovered(page)).toBe(false)
	await loupe.getByRole('button', { name: 'Toggle Nextcloud navigation' }).click()
	await expect.poll(() => headerUncovered(page)).toBe(true)

	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()
	await expect(page.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeFocused()
})

// spec: LOUPE-002.11
test('puts Pick and Reject at the side edges in landscape and in a row below the photo in portrait', async ({ page }) => {
	const loupe = await openLoupe(page)
	const box = async (name: string) => (await loupe.getByRole('button', { name, exact: true }).first().boundingBox())!
	const frame = (await loupe.boundingBox())!

	const [pick, reject] = [await box('Pick'), await box('Reject')]
	expect(pick.x - frame.x).toBeLessThan(frame.width / 10)
	expect(frame.x + frame.width - (reject.x + reject.width)).toBeLessThan(frame.width / 4)
	expect(reject.x).toBeGreaterThan(frame.x + frame.width / 2)

	await page.setViewportSize({ width: 600, height: 900 })
	const photo = (await loupe.getByRole('img', { name: 'IMG_0001' }).boundingBox())!
	const [portraitPick, portraitReject, unflag] = [await box('Pick'), await box('Reject'), await box('Unflag')]
	expect(portraitPick.y).toBeGreaterThanOrEqual(photo.y + photo.height)
	expect(portraitReject.y).toBe(portraitPick.y)
	expect(unflag.y).toBe(portraitPick.y)
	expect(portraitPick.x).toBeLessThan(portraitReject.x)
	expect(portraitReject.x).toBeLessThan(unflag.x)
})

// spec: KEYS-001.10, KEYS-001.12
test('picks by P, undoes it by Ctrl+Z and opens the shortcut sheet by ?', async ({ page }) => {
	const loupe = await openLoupe(page)
	const toast = page.getByRole('status').filter({ hasText: 'IMG_0001' })

	await page.keyboard.press('p')
	await expect(toast).toContainText('Picked IMG_0001')
	await page.keyboard.press('Control+z')
	await expect(toast).toContainText('Undid: Picked IMG_0001')
	await page.keyboard.press('ArrowLeft')
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(loupe.getByRole('button', { name: 'Pick' }).first()).toHaveAttribute('aria-pressed', 'false')

	await page.keyboard.press('Shift+?')
	const sheet = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
	await expect(sheet.getByRole('heading', { name: 'Flags' })).toBeVisible()
	await sheet.getByRole('button', { name: 'Close' }).last().click()
	await expect(sheet).toBeHidden()
})
