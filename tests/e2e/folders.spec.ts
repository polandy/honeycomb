// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { expectAccessible, SCHEMES } from './a11y.ts'
import { putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { logIn, occ, trackRequests } from './server.ts'
import { emulateIpad, expectTouchTargets } from './touch-targets.ts'
import { WEBKIT } from './webkit.ts'

/** The folders below the library root, each with one photo; enough rows to scroll on a short screen. */
const FOLDERS = ['Alps', 'Beach', 'City', 'Desert', 'Forest', 'Glacier', 'Harbour', 'Island']
const ROOT = '/Library'
/** The subfolders put below *Alps*, so it is a level with photos of its own. */
const DAYS = ['Day 1', 'Day 2']
const SETTINGS_SAVED = /\/api\/v1\/settings$/

test.use({ storageState: { cookies: [], origins: [] }, hasTouch: true })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `folders-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	await createFolder(page, 'Library', user.username)
	for (const folder of FOLDERS) {
		await createFolder(page, `Library/${folder}`, user.username)
		await upload(page, `Library/${folder}/IMG_0001.jpg`, JPEG, user.username)
	}
})

// SQLite refuses the deletion while a request of the page still writes, such as a preview render.
test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

/** Opens the app on the list of the library root, once its folders are summarised. */
async function openList(page: Page) {
	await putSettings(page, { libraryRoots: [ROOT] })
	await page.goto('/index.php/apps/honeycomb/')
	const list = page.locator('.folders-screen')
	await expect(list.getByRole('article', { name: 'Alps' })).toBeVisible()
	return list
}

// spec: FOLDERS-007.2, FOLDERS-007.3, FOLDERS-007.5, FOLDERS-007.17
test('sets up the library root on the first run and shows its folders', async ({ page }) => {
	await emulateIpad(page, 'landscape')
	await page.reload()
	const setup = page.locator('.library-setup')
	await expect(setup.getByRole('heading', { name: 'Where is your library?' })).toBeVisible()
	await expect(setup.getByRole('button', { name: 'Show folders' })).toBeDisabled()
	for (const scheme of SCHEMES) {
		await page.emulateMedia({ colorScheme: scheme })
		await expectAccessible(page, `library setup, ${scheme}`)
	}
	await expectTouchTargets(setup, 'library setup')

	await setup.getByRole('treeitem').filter({ has: page.locator('.folder-tree__name').getByText('Library', { exact: true }) }).click()
	await setup.getByRole('button', { name: 'Add as root' }).click()
	await expect(setup.getByRole('list', { name: 'Library roots' })).toContainText(ROOT)
	await setup.getByRole('button', { name: 'Show folders' }).click()

	await expect(page.locator('.folders-screen').getByRole('article', { name: 'Alps' })).toBeVisible()
})

// spec: FOLDERS-007.7
test('says how many folders it updates while the server summarises them', async ({ page }) => {
	let release: () => void = () => undefined
	const held = new Promise<void>((resolve) => (release = resolve))
	await page.route('**/api/v1/library/scan', async (route) => {
		await held
		await route.continue()
	})
	await putSettings(page, { libraryRoots: [ROOT] })
	await page.goto('/index.php/apps/honeycomb/')

	const strip = page.locator('.folders-screen__updating')
	await expect(strip).toContainText(/Updating \d+ folders/)
	release()

	await expect(strip).toBeHidden()
	await expect(page.locator('.folders-screen').getByRole('article')).toHaveCount(FOLDERS.length)
})

// spec: FOLDERS-007.9, FOLDERS-007.11, FOLDERS-007.12, FOLDERS-007.17
test('lists the folders with the library\'s progress, accessible and touch-sized', async ({ page }) => {
	await emulateIpad(page, 'landscape')
	const list = await openList(page)

	await expect(list.getByRole('region', { name: 'Library progress' })).toContainText(`1 root · ${FOLDERS.length} folders · ${FOLDERS.length} photos`)
	await expect(list.getByRole('article', { name: 'Alps' }).getByRole('button', { name: 'Cull Alps' })).toBeVisible()
	for (const scheme of SCHEMES) {
		await page.emulateMedia({ colorScheme: scheme })
		await expectAccessible(page, `folders, ${scheme}`)
	}
	await expectTouchTargets(list, 'folders')

	await list.getByRole('button', { name: 'More for Alps' }).click()
	const menu = page.getByRole('dialog', { name: 'Alps' })
	await expect(menu.getByRole('button', { name: 'Cull with subfolders' })).toBeVisible()
	await expectAccessible(page, 'folder menu')
	await expectTouchTargets(menu, 'folder menu')
	await menu.getByRole('button', { name: 'Cancel' }).click()
	await expect(menu).toBeHidden()
})

// spec: FOLDERS-007.12
test('opens the row\'s menu as a bottom sheet on a phone', async ({ page }) => {
	const phone = { width: 390, height: 844 }
	await page.setViewportSize(phone)
	const list = await openList(page)

	await list.getByRole('button', { name: 'More for Alps' }).click()

	const sheet = page.getByRole('dialog', { name: 'Alps' }).locator('.modal-container')
	await expect(sheet).toBeVisible()
	const box = (await sheet.boundingBox())!
	expect(box.width).toBe(phone.width)
	expect(box.y + box.height).toBe(phone.height)
})

// spec: FOLDERS-007.13, FOLDERS-007.14
test('culls a folder from the list and goes back to it with its filter and scroll', async ({ page }) => {
	await page.setViewportSize({ width: 1133, height: 500 })
	const list = await openList(page)
	await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ }).click()
	const cull = list.getByRole('button', { name: 'Cull Harbour' })
	await cull.scrollIntoViewIfNeeded()
	const scrolled = await list.evaluate((element) => element.scrollTop)
	expect(scrolled).toBeGreaterThan(0)

	await cull.click()
	await expect(page.getByRole('gridcell', { name: 'IMG_0001, JPG only' })).toBeVisible()
	await expect(list).toBeHidden()
	await page.getByRole('button', { name: 'Back to folders' }).click()

	await expect(list).toBeVisible()
	await expect(list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
	await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(scrolled)
	await expect(page.getByRole('grid', { name: 'Photos' })).toHaveCount(0)
})

/** Puts the days below *Alps*, each with one photo. */
async function addDays(page: Page) {
	for (const day of DAYS) {
		await createFolder(page, `Library/Alps/${day}`, user.username)
		await upload(page, `Library/Alps/${day}/IMG_0001.jpg`, JPEG, user.username)
	}
}

// spec: FOLDERS-009.1, FOLDERS-009.4, FOLDERS-009.5, FOLDERS-009.8, FOLDERS-009.19
test('opens a level by its row and breadcrumb and keeps Include subfolders off after a reload', { tag: WEBKIT }, async ({ page }) => {
	await emulateIpad(page, 'landscape')
	await addDays(page)
	const list = await openList(page)
	const subfolders = list.getByRole('switch', { name: 'Include subfolders' })
	await expect(subfolders).toBeChecked()
	await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ }).click()
	await expect(list.getByRole('article', { name: 'Alps' })).toContainText('3 photos')

	await list.getByRole('button', { name: 'Open Alps' }).click()

	const crumbs = list.getByRole('navigation', { name: 'Level' })
	await expect(crumbs.locator('[aria-current="location"]')).toHaveText('Alps')
	await expect(list.getByRole('button', { name: 'Cull this level' })).toBeEnabled()
	await expect(list.getByRole('article', { name: 'Photos directly in Alps' })).toContainText('1 photo')
	await expect(list.getByRole('article', { name: 'Day 1' })).toBeVisible()
	for (const scheme of SCHEMES) {
		await page.emulateMedia({ colorScheme: scheme })
		await expectAccessible(page, `folder level, ${scheme}`)
	}
	await expectTouchTargets(list, 'folder level')
	await crumbs.getByRole('button', { name: 'Library' }).click()
	await expect(list.getByRole('article', { name: 'Beach' })).toBeVisible()

	const saved = page.waitForResponse((response) => SETTINGS_SAVED.test(response.url()) && response.request().method() === 'PUT' && response.ok())
	await list.getByText('Include subfolders', { exact: true }).click()
	await saved
	await page.reload()

	await expect(list.getByRole('switch', { name: 'Include subfolders' })).not.toBeChecked()
	await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ }).click()
	await expect(list.getByRole('article', { name: 'Alps' })).toContainText('1 photo')
})

// spec: FOLDERS-009.16, FOLDERS-009.19
test('shows a level on a phone without a horizontal scroll and goes back to it from a cull', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await addDays(page)
	const list = await openList(page)
	await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ }).click()
	await list.getByRole('button', { name: 'Open Alps' }).click()
	await expect(list.getByRole('article', { name: 'Day 2' })).toBeVisible()

	expect(await list.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
	for (const scheme of SCHEMES) {
		await page.emulateMedia({ colorScheme: scheme })
		await expectAccessible(page, `folder level on a phone, ${scheme}`)
	}
	await expectTouchTargets(list, 'folder level on a phone')

	await list.getByRole('button', { name: 'Cull Day 2' }).click()
	await expect(page.getByRole('gridcell', { name: 'IMG_0001, JPG only' })).toBeVisible()
	await page.getByRole('button', { name: 'Back to folders' }).click()

	await expect(list.getByRole('navigation', { name: 'Level' }).locator('[aria-current="location"]')).toHaveText('Alps')
	await expect(list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true')
})
