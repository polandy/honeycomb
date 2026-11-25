// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { logIn, occ, trackRequests } from './server.ts'

const ROOT = '/Library'
const PHONE = { width: 390, height: 844 }
const DESKTOP = { width: 1440, height: 900 }

test.use({ storageState: { cookies: [], origins: [] } })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `title-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	await createFolder(page, 'Library', user.username)
	await createFolder(page, 'Library/Alps', user.username)
	await upload(page, 'Library/Alps/IMG_0001.jpg', JPEG, user.username)
})

test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

/** The pages with a title row: the library setup, then the folder list. */
const PAGES = [
	{ name: 'library setup', open: async (page: Page) => page.goto('/index.php/apps/honeycomb/'), title: 'Where is your library?' },
	{
		name: 'folders',
		open: async (page: Page) => {
			await putSettings(page, { libraryRoots: [ROOT] })
			await page.goto('/index.php/apps/honeycomb/')
			await expect(page.locator('.folders-screen').getByRole('article', { name: 'Alps' })).toBeVisible()
		},
		title: 'Library',
	},
]

/** The title's text box, which is what the toggle must not cover. */
function titleBox(row: Locator) {
	return row.getByRole('heading').evaluate((heading) => {
		const range = document.createRange()
		range.selectNodeContents(heading)
		const { left, right, top, bottom } = range.getBoundingClientRect()
		return { left, right, top, bottom }
	})
}

// spec: APP-001.22
for (const shown of PAGES) {
	test(`keeps the ${shown.name} title clear of the navigation toggle on a phone`, async ({ page }) => {
		await page.setViewportSize(PHONE)
		await shown.open(page)
		const row = page.locator('.page-title-row')
		await expect(row.getByRole('heading', { name: shown.title })).toBeVisible()

		const toggle = (await page.locator('.app-navigation-toggle').boundingBox())!
		const title = await titleBox(row)
		expect(title.left).toBeGreaterThanOrEqual(toggle.x + toggle.width)
		const rowBox = (await row.boundingBox())!
		expect(rowBox.y).toBeLessThanOrEqual(toggle.y)
		expect(rowBox.y + rowBox.height).toBeGreaterThanOrEqual(toggle.y + toggle.height)
	})

	// spec: APP-001.22
	test(`sets the ${shown.name} title flush left beside the open navigation on a desktop`, async ({ page }) => {
		await page.setViewportSize(DESKTOP)
		await shown.open(page)
		const toggle = page.locator('.app-navigation-toggle')
		await expect(toggle).toHaveAttribute('aria-expanded', 'true')
		const row = page.locator('.page-title-row')
		await expect(row.getByRole('heading', { name: shown.title })).toBeVisible()

		expect(await row.evaluate((element) => getComputedStyle(element).paddingInlineStart)).toBe('0px')
	})
}
