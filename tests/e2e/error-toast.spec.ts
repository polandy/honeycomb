// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

// The toast's lifetime (src/shared/toast.ts), a little over.
const PAST_TOAST_MS = 6000

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: APP-001.13
test('keeps an error toast announced as an alert until it is closed', async ({ page }, testInfo) => {
	await page.clock.install()
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Alert ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	await page.route('**/apps/honeycomb/api/v1/settings', (route) => (route.request().method() === 'PUT' ? route.fulfill({ status: 500 }) : route.continue()))

	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: 'Settings', exact: true }).click()
	await page.getByRole('dialog', { name: 'Settings' }).getByText('Show singles', { exact: true }).click()
	const alert = page.getByRole('alert').filter({ hasText: 'Could not save the settings' })
	await expect(alert).toBeVisible()
	await page.clock.runFor(PAST_TOAST_MS)

	await expect(alert).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(page.getByRole('dialog', { name: 'Settings' })).toBeHidden()
	await expect(alert).toBeVisible()
	await alert.screenshot({ path: testInfo.outputPath('error-toast.png') })
	await alert.getByRole('button', { name: 'Close' }).focus()
	await page.keyboard.press('Enter')
	await expect(alert).toBeHidden()
})
