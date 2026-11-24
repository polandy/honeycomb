// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

const SHORT_VIEWPORT = { width: 1133, height: 420 }

// spec: GRID-001.18
test('scrolls the ⋯ menu on a short viewport so its last entry is reachable', async ({ page }) => {
	await page.setViewportSize(SHORT_VIEWPORT)
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Menu ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)

	await page.getByRole('button', { name: 'More' }).click()
	const menu = page.locator('.grid-more-menu')
	await expect(menu).toBeVisible()
	expect(await menu.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true)

	await menu.evaluate((el) => el.scrollTo(0, el.scrollHeight))
	const settings = menu.getByRole('button', { name: 'Settings' })
	await expect(settings).toBeInViewport({ ratio: 1 })
})
