// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const OPENERS: Record<string, (page: Page) => Promise<void>> = {
	'the toolbar': (page) => page.getByRole('button', { name: /^Compare series \(\d+\)$/ }).click(),
	'the n key': (page) => page.keyboard.press('n'),
	'a grid series badge': (page) => page.getByRole('button', { name: /^Series of 2 – compare/ }).click(),
}

for (const [way, open] of Object.entries(OPENERS)) {
	// spec: APP-001.12
	test(`logs no console error from choosing a folder to opening the series compare from ${way}`, async ({ page }) => {
		const errors: string[] = []
		page.on('console', (message) => message.type() === 'error' && errors.push(message.text()))
		page.on('pageerror', (error) => errors.push(error.message))
		await page.goto('/index.php/apps/honeycomb/')
		const folder = `Series ${randomUUID().slice(0, 8)}`
		await createFolder(page, folder)
		await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
		await upload(page, `${folder}/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:01'))
		await cullFolder(page, folder)
		await expect(page.getByRole('gridcell')).toHaveCount(2)

		await open(page)
		await expect(page.locator('.series-compare__photo').first()).toBeFocused()
		await expect(page.locator('.series-compare-dialog')).not.toHaveClass(/fade-enter/)

		expect(errors).toEqual([])
	})
}
