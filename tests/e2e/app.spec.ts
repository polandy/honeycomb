// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { occ } from './server.ts'

// A background job in a page request keeps the shared locks of the files it read until it ends, so a trash meanwhile fails.
test('runs background jobs only when a test asks for one, never inside a page request', () => {
	expect(occ(['config:app:get', 'core', 'backgroundjobs_mode', '--default-value=ajax']).trim()).toBe('cron')
})

// spec: APP-001.3
test('opens on the empty state while no folder is chosen', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	const emptyState = page.getByRole('note', { name: 'No folder chosen' })
	await expect(emptyState).toBeVisible()
	await expect(emptyState.getByText('Pick a folder to start culling.')).toBeVisible()
})

// spec: APP-001.10
test('loads its script by the hashed name of the build and opens on the folder tree', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	await expect(page.locator('script[src*="/js/honeycomb-main-"]')).toHaveCount(1)
	await expect(page.getByRole('dialog', { name: 'Choose folders' }).getByRole('tree', { name: 'Folders' })).toBeVisible()
})

// spec: APP-001.6
test('shows a dialog as a bottom sheet on a phone', async ({ page }) => {
	const phone = { width: 390, height: 844 }
	await page.setViewportSize(phone)
	await page.goto('/index.php/apps/honeycomb/')

	const sheet = page.getByRole('dialog', { name: 'Choose folders' }).locator('.modal-container')
	await expect(sheet).toBeVisible()
	const box = (await sheet.boundingBox())!
	expect(box.x).toBe(0)
	expect(box.width).toBe(phone.width)
	expect(box.y + box.height).toBe(phone.height)
	expect(box.y).toBeGreaterThanOrEqual(24)
	await expect(sheet).toHaveCSS('border-top-left-radius', '16px')
	await expect(sheet).toHaveCSS('border-bottom-left-radius', '0px')
})

// spec: APP-001.7, APP-001.8
test('starts the navigation closed on a laptop and keeps it open once the user opened it', async ({ page }) => {
	await page.setViewportSize({ width: 1180, height: 820 })
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Navigation ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	const toggle = page.locator('.app-navigation-toggle')
	await expect(toggle).toHaveAttribute('aria-expanded', 'false')

	await toggle.click()
	await expect(toggle).toHaveAttribute('aria-expanded', 'true')
	await expect.poll(() => page.evaluate(() => window.localStorage.getItem('honeycomb.navigationOpen'))).toBe('true')
	await page.reload()

	await expect(page.locator('.app-navigation-toggle')).toHaveAttribute('aria-expanded', 'true')
	await expect(page.getByRole('navigation', { name: 'honeycomb navigation' }).getByText('Folder', { exact: true })).toBeVisible()
})
