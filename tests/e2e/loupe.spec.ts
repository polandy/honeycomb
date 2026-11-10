// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

/** Whether the middle of Nextcloud's header is on top, not under the loupe. */
function headerUncovered(page: Page) {
	return page.evaluate(() => {
		const header = document.getElementById('header')!.getBoundingClientRect()
		return document.elementFromPoint(header.x + header.width / 2, header.y + header.height / 2)?.closest('#header') !== null
	})
}

test('opens a photo in the loupe, pages by key and closes back to the grid', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
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
