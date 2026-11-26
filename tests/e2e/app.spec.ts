// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder, openFolderPicker } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { occ } from './server.ts'

// A background job in a page request keeps the shared locks of the files it read until it ends, so a trash meanwhile fails.
test('runs background jobs only when a test asks for one, never inside a page request', () => {
	expect(occ(['config:app:get', 'core', 'backgroundjobs_mode', '--default-value=ajax']).trim()).toBe('cron')
})

// spec: APP-001.3
test('opens on the library setup while no library root is chosen, the folder picker closed', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	await expect(page.getByRole('heading', { name: 'Where is your library?' })).toBeVisible()
	await expect(page.getByRole('dialog', { name: 'Choose folders' })).toHaveCount(0)
})

// spec: APP-001.10
test('loads its script by the hashed name of the build and opens the folder tree from the navigation', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	await expect(page.locator('script[src*="/js/honeycomb-main-"]')).toHaveCount(1)
	await expect((await openFolderPicker(page)).getByRole('tree', { name: 'Folders' })).toBeVisible()
})

// spec: APP-001.6
test('shows a dialog as a bottom sheet on a phone', async ({ page }) => {
	const phone = { width: 390, height: 844 }
	await page.setViewportSize(phone)
	await page.goto('/index.php/apps/honeycomb/')

	const sheet = (await openFolderPicker(page)).locator('.modal-container')
	await expect(sheet).toBeVisible()
	const box = (await sheet.boundingBox())!
	expect(box.x).toBe(0)
	expect(box.width).toBe(phone.width)
	expect(box.y + box.height).toBe(phone.height)
	expect(box.y).toBeGreaterThanOrEqual(24)
	await expect(sheet).toHaveCSS('border-top-left-radius', '16px')
	await expect(sheet).toHaveCSS('border-bottom-left-radius', '0px')
})

// spec: APP-001.17
test('opens a dialog without a transition or an animation under reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/index.php/apps/honeycomb/')

	await openFolderPicker(page)
	const moving = await page.evaluate(() => {
		const parts = [...document.querySelectorAll('.modal-mask, .modal-mask *')]
		const transitions = parts.filter((part) => getComputedStyle(part).transitionDuration.split(',').some((duration) => parseFloat(duration) > 0))
		const animations = document.getAnimations().filter((animation) => parts.includes((animation.effect as KeyframeEffect | null)?.target as Element))
		return [...transitions.map((part) => `transition on ${part.className}`), ...animations.map((animation) => `animation ${animation.id}`)]
	})
	expect(moving).toEqual([])
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
	await expect.poll(() => page.evaluate((user) => window.localStorage.getItem(`honeycomb.navigationOpen.${user}`), ADMIN.username)).toBe('true')
	await page.reload()

	await expect(page.locator('.app-navigation-toggle')).toHaveAttribute('aria-expanded', 'true')
	await expect(page.getByRole('navigation', { name: 'honeycomb navigation' }).getByText('Folder', { exact: true })).toBeVisible()
})
