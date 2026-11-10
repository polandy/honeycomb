// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW, requestToken, upload } from './files.ts'

const SETTINGS_URL = '/index.php/apps/honeycomb/api/v1/settings'

test.afterEach(async ({ page }) => {
	const reset = await page.request.put(SETTINGS_URL, { data: { settings: {} }, headers: { requesttoken: await requestToken(page) } })
	expect(reset.status(), await reset.text()).toBe(200)
})

// spec: SETTINGS-001.10, SETTINGS-001.11
test('turns Show singles off in the settings and keeps it after a reload', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Prefs ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: 'Settings', exact: true }).click()
	const settings = page.getByRole('dialog', { name: 'Settings' })
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/settings') && response.request().method() === 'PUT')
	await settings.getByText('Show singles', { exact: true }).click()
	expect((await saved).status()).toBe(200)
	await page.keyboard.press('Escape')

	await expect(settings).toBeHidden()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await page.reload()
	await cullFolder(page, folder)
	await expect(grid.getByRole('gridcell', { name: /^IMG_0001, JPG\+NEF/ })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
})
