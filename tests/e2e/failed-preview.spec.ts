// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

const PREVIEWS = '**/api/v1/images/**'

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: GRID-001.23
test('shows a failed preview as a broken tile and loads it again on a tap', async ({ page }, testInfo) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Failed ${randomUUID().slice(0, 8)}`
	await putSettings(page, { sidecarWrite: 'off' })
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await page.route(PREVIEWS, (route) => route.fulfill({ status: 500 }))
	await cullFolder(page, folder)

	const tile = page.getByRole('gridcell', { name: /IMG_0001/ })
	await expect(tile).toHaveClass(/photo-tile--failed/)
	await expect(tile).toContainText('IMG_0001')
	await expect(tile).toHaveAttribute('aria-label', /Preview failed to load/)
	await tile.screenshot({ path: testInfo.outputPath('failed-tile.png') })
	await page.keyboard.press('p')
	await expect(tile).toHaveAttribute('aria-label', /Picked/)

	await page.unroute(PREVIEWS)
	await tile.click()
	await expect(tile.locator('img')).toBeVisible()
	await expect(tile).not.toHaveClass(/photo-tile--failed/)
	await tile.click()
	await expect(page.getByRole('dialog', { name: /IMG_0001/ }).or(page.locator('.photo-loupe'))).toBeVisible()
})
