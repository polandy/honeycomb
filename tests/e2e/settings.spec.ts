// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW, requestToken, upload } from './files.ts'

const SETTINGS_URL = '/index.php/apps/honeycomb/api/v1/settings'
// The reference devices the opt-in dialog is captured on (docs/plan.md Reference devices).
const SCREENSHOT_VIEWPORTS = { 'pixel-portrait': { width: 427, height: 952 }, 'ipad-mini-portrait': { width: 744, height: 1133 }, 'ipad-mini-landscape': { width: 1133, height: 744 } }

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

// spec: SETTINGS-001.23
test('starts every text line of a settings section at its heading', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Layout ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: 'Settings', exact: true }).click()
	const settings = page.getByRole('dialog', { name: 'Settings' })
	const textStart = (locator: Locator): Promise<number> => locator.evaluate((element) => {
		const style = getComputedStyle(element)
		return element.getBoundingClientRect().left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft)
	})
	const lines: Record<string, string[]> = {
		'File types': ['Per user. Files are paired by name, ignoring case.', 'RAW extensions', 'Rendered extensions'],
		'Loupe gestures': ['A direction set to Nothing turns that swipe off.', 'Swipe up', 'Gesture guide'],
		'Moving photos': ['Favourite folders'],
		'XMP sidecars': ['Your decisions always stay in honeycomb. Choose whether they also go into the XMP sidecars next to your photos, where digiKam, darktable and Lightroom read them.'],
	}
	for (const [section, texts] of Object.entries(lines)) {
		const heading = await textStart(settings.getByRole('heading', { name: section, exact: true }))
		for (const text of texts) {
			expect(await textStart(settings.getByText(text, { exact: true })), `${section}: ${text}`).toBe(heading)
		}
	}
})

// spec: SETTINGS-001.24
test('asks before writing to sidecars and saves the choice once confirmed', async ({ page }, testInfo) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Sidecars ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: 'Settings', exact: true }).click()
	const settings = page.getByRole('dialog', { name: 'Settings' })
	const choices = settings.getByRole('group', { name: 'Write decisions to XMP sidecars' })
	const off = choices.getByRole('radio', { name: /^Off/ })
	await choices.scrollIntoViewIfNeeded()
	await expect(off).toBeChecked()
	await settings.locator('section', { has: page.getByRole('heading', { name: 'XMP sidecars', exact: true }) }).screenshot({ path: testInfo.outputPath('xmp-sidecars-section.png'), animations: 'disabled' })

	await choices.getByText('Existing and new sidecars', { exact: true }).click()
	const ask = page.getByRole('dialog', { name: 'Write decisions to XMP sidecars?' })
	await expect(ask).toContainText('IMG_0001.NEF.xmp')
	for (const [device, viewport] of Object.entries(SCREENSHOT_VIEWPORTS)) {
		await page.setViewportSize(viewport)
		await page.screenshot({ path: testInfo.outputPath(`xmp-sidecars-dialog-${device}.png`), animations: 'disabled' })
	}
	await ask.getByRole('button', { name: 'Cancel' }).click()
	await expect(ask).toBeHidden()
	await expect(off).toBeChecked()

	await choices.getByText('Only existing sidecars', { exact: true }).click()
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/settings') && response.request().method() === 'PUT')
	await ask.getByRole('button', { name: 'Write to sidecars' }).click()
	expect((await saved).request().postDataJSON()).toMatchObject({ settings: { sidecarWrite: 'existing' } })
	await expect(choices.getByRole('radio', { name: /^Only existing sidecars/ })).toBeChecked()
})
