// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const PHONE = { width: 320, height: 640 }

// spec: SERIES-001.13
test('wraps Pick this, reject the rest to two lines in a phone-wide compare card', async ({ page }) => {
	await page.setViewportSize(PHONE)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Series ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.keyboard.press('n')

	const button = page.getByRole('dialog', { name: 'Compare series 1 of 1' }).getByRole('button', { name: 'Pick this, reject the rest' }).first()
	await expect(button).toBeVisible()
	const label = button.locator('.button-vue__text')
	await expect(button.locator('.button-vue__icon')).toBeHidden()
	const lines = await label.evaluate((element) => {
		const range = document.createRange()
		range.selectNodeContents(element)
		return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size
	})
	expect(lines).toBe(2)
	expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
})
