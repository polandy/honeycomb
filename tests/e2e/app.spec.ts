// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'

// spec: APP-001.3
test('opens on the empty state while no folder is chosen', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	const emptyState = page.getByRole('note', { name: 'No folder chosen' })
	await expect(emptyState).toBeVisible()
	await expect(emptyState.getByText('Pick a folder to start culling.')).toBeVisible()
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
