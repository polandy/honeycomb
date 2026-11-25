// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { logIn, occ, trackRequests } from './server.ts'

/** A nested library like the owner's test set: a trip below a year, a chain and a folder without photos. */
const PHOTO_FOLDERS = ['2024/Iceland/Day 1', '2024/Iceland/Day 2', '2024/Jura', 'Archive/Analog/Scans 1998']
const EMPTY_FOLDERS = ['Documents']
const ROOT = 'Library'
const VIEWPORTS = [{ name: 'a desktop', width: 1440, height: 900 }, { name: 'a phone', width: 390, height: 844 }]

test.use({ storageState: { cookies: [], origins: [] }, hasTouch: true })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `hierarchy-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const created = new Set<string>()
	for (const folder of [...PHOTO_FOLDERS, ...EMPTY_FOLDERS]) {
		const parts = `${ROOT}/${folder}`.split('/')
		for (let depth = 1; depth <= parts.length; depth++) {
			const path = parts.slice(0, depth).join('/')
			if (!created.has(path)) {
				created.add(path)
				await createFolder(page, path, user.username)
			}
		}
	}
	for (const folder of PHOTO_FOLDERS) {
		await upload(page, `${ROOT}/${folder}/IMG_0001.jpg`, JPEG, user.username)
	}
	await putSettings(page, { libraryRoots: [`/${ROOT}`] })
})

// SQLite refuses the deletion while a request of the page still writes, such as a preview render.
test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

/** Expects the row's cover to show a loaded thumbnail that does not overlap the row's name. */
async function expectCover(row: Locator) {
	const image = row.locator('.folder-cover img').first()
	await expect(image).toBeVisible()
	await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
	const cover = (await row.locator('.folder-cover').boundingBox())!
	const name = (await row.locator('.folder-row__name').boundingBox())!
	expect(cover.x + cover.width <= name.x || name.y >= cover.y + cover.height).toBe(true)
}

/** The shown level's name in the breadcrumb. */
function current(page: Page): Locator {
	return page.locator('.folders-screen').getByRole('navigation', { name: 'Level' }).locator('[aria-current="location"]')
}

for (const viewport of VIEWPORTS) {
	// spec: FOLDERS-009.1, FOLDERS-009.2, FOLDERS-009.3, FOLDERS-009.20, FOLDERS-009.22
	test(`opens the library on its hierarchy and walks it by row and breadcrumb on ${viewport.name}`, async ({ page }, testInfo) => {
		await page.setViewportSize({ width: viewport.width, height: viewport.height })
		await page.goto('/index.php/apps/honeycomb/')
		const list = page.locator('.folders-screen')
		const filters = list.getByRole('group', { name: 'Filter' }).getByRole('button')

		const year = list.getByRole('article', { name: '2024' })
		await expect(year).toContainText('3 photos')
		await expect(year).toContainText('3 folders')
		await expect(filters.first()).toHaveText(/^All/)
		await expect(filters.first()).toHaveAttribute('aria-pressed', 'true')
		await expect(list.getByRole('article', { name: 'Archive / Analog / Scans 1998' })).toBeVisible()
		await expect(list.getByRole('article', { name: 'Day 1' })).toHaveCount(0)
		await expect(list.getByText('Documents')).toHaveCount(0)
		await expectCover(year)
		await list.screenshot({ path: testInfo.outputPath('folders-library-level.png') })

		await year.click({ position: { x: 4, y: 4 } })
		await expect(current(page)).toHaveText('2024')
		await expect(list.locator('.folder-level-card').getByRole('button')).toHaveText('Cull this level (with subfolders)')
		const iceland = list.getByRole('article', { name: 'Iceland' })
		await expect(iceland).toContainText('2 photos')
		await list.getByRole('button', { name: 'Open Iceland' }).click()
		await expect(current(page)).toHaveText('Iceland')
		await expect(list.getByRole('article', { name: 'Day 2' })).toBeVisible()
		await list.screenshot({ path: testInfo.outputPath('folders-iceland-level.png') })

		await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^Suggested/ }).click()
		await list.getByRole('navigation', { name: 'Level' }).getByRole('button', { name: '2024' }).click()
		await expect(current(page)).toHaveText('2024')
		await expect(filters.first()).toHaveAttribute('aria-pressed', 'true')
		await expect(list.getByRole('article', { name: 'Iceland' })).toBeVisible()
		expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
	})
}
