// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { createFolder, JPEG, RAW, upload } from './files.ts'

// The reference devices the name bar and tile info are captured on (docs/dev/plan.md Reference devices).
const SCREENSHOT_VIEWPORTS = { 'pixel-portrait': { width: 427, height: 952 }, 'ipad-mini-landscape': { width: 1133, height: 744 } }

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: GRID-004.2, GRID-004.3, GRID-004.4, GRID-004.7, GRID-004.8, GRID-004.9
test('shows the file names from the More menu, hides them by Shift+J and shows the tile info on a mouse rest', async ({ page }, testInfo) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Names ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await cullFolder(page, folder)

	const grid = page.getByRole('grid', { name: 'Photos' })
	const tile = grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' })
	await expect(tile).toBeVisible()
	await expect(grid.locator('.photo-tile__name')).toHaveCount(0)

	await page.getByRole('button', { name: 'More' }).click()
	await page.getByText('Show file names').click()
	await expect(page.getByRole('checkbox', { name: /Show file names/ })).toBeChecked()
	await page.keyboard.press('Escape')
	await expect(tile.locator('.photo-tile__name')).toHaveText('IMG_0001')

	await tile.hover()
	const info = page.locator('.tile-info')
	await expect(info).toContainText('JPG + NEF')
	await expect(info).toContainText('☆☆☆☆☆')
	for (const [device, viewport] of Object.entries(SCREENSHOT_VIEWPORTS)) {
		await page.setViewportSize(viewport)
		await page.mouse.move(0, 0)
		await tile.hover()
		await expect(info).toBeVisible()
		await page.screenshot({ path: testInfo.outputPath(`file-names-${device}.png`), animations: 'disabled' })
	}
	await page.emulateMedia({ colorScheme: 'dark' })
	await page.screenshot({ path: testInfo.outputPath('file-names-dark.png'), animations: 'disabled' })

	await page.mouse.move(0, 0)
	await expect(info).toBeHidden()
	await page.keyboard.press('Shift+J')
	await expect(grid.locator('.photo-tile__name')).toHaveCount(0)
})
