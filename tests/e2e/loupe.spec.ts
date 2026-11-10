// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createFolder, JPEG, upload } from './files.ts'

test('opens a photo in the loupe, pages by key and closes back to the grid', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Loupe ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await picker.getByRole('option', { name: folder }).click()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()

	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(loupe.getByText('1 of 2')).toBeVisible()
	await expect(loupe.getByRole('img', { name: 'IMG_0001' })).toHaveJSProperty('complete', true)

	await page.keyboard.press('ArrowRight')
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 2')).toBeVisible()

	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()
	await expect(page.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeFocused()
})
