// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { expectAccessible, SCHEMES } from './a11y.ts'
import { E2E_SETTINGS, putSettings } from './cull.ts'
import { expectTouchTargets } from './touch-targets.ts'

// The *Mark done* toast's lifetime (src/folder-done.ts), a little under and a little over.
const BEFORE_UNDO_MS = 7500
const PAST_UNDO_MS = 1000
const ROOT = '/Library'
const DONE = { by: 'e2e', at: 1_800_000_000, photos: 3 }

/** A rateable row of the stubbed list. */
function folder(fileId: number, name: string, fields: object) {
	return { fileId, root: ROOT, path: `${ROOT}/${name}`, photos: 3, bytes: 3_000_000, rawBytes: 0, picked: 3, rejected: 0, undecided: 0, bursts: 0, oldest: 1_600_000_000, newest: 1_600_000_100, lastActivity: null, permissions: 31, done: null, ...fields }
}

const FOLDERS = [
	folder(9001, 'Complete', {}),
	folder(9002, 'Grown', { photos: 12, picked: 10, undecided: 2, done: { ...DONE, photos: 10 } }),
	folder(9003, 'Open', { picked: 1, undecided: 2 }),
]

/** Stubs the list and the done endpoints; answers the done writes as `METHOD fileId`. */
async function stubLibrary(page: Page): Promise<string[]> {
	const writes: string[] = []
	await page.route('**/apps/honeycomb/api/v1/library/folders?**', (route) => route.fulfill({ json: { folders: FOLDERS, next: null, scanning: null } }))
	await page.route('**/apps/honeycomb/api/v1/library/folders/*/done', (route) => {
		const fileId = Number(route.request().url().split('/').at(-2))
		writes.push(`${route.request().method()} ${fileId}`)
		return route.request().method() === 'PUT' ? route.fulfill({ json: { fileId, done: DONE } }) : route.fulfill({ status: 204 })
	})
	return writes
}

/** Opens the app on the stubbed list below `ROOT`, its clock installed. */
async function openList(page: Page) {
	await page.clock.install()
	await page.goto('/index.php/apps/honeycomb/')
	// The settings write needs the page's request token; the reload reads the roots.
	await putSettings(page, { libraryRoots: [ROOT] })
	await page.reload()
	const list = page.locator('.folders-screen')
	await expect(list.getByRole('article', { name: 'Complete' })).toBeVisible()
	// *Suggested* hides done folders; *All* keeps every row in view.
	await list.getByRole('group', { name: 'Filter' }).getByRole('button', { name: /^All/ }).click()
	return list
}

// A phone has a coarse pointer, which gives the controls their touch size.
test.use({ hasTouch: true })

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

// spec: FOLDERS-008.1, FOLDERS-008.3, FOLDERS-008.7
test('marks a complete folder done with a toast that offers Undo for 8 s', async ({ page }, testInfo) => {
	const writes = await stubLibrary(page)
	const list = await openList(page)
	const grown = list.getByRole('article', { name: 'Grown' })
	await expect(grown).toContainText('2 new')
	await expect(grown.getByRole('button', { name: 'Cull new in Grown' })).toBeVisible()
	await grown.screenshot({ path: testInfo.outputPath('folders-new-badge.png') })

	await list.getByRole('button', { name: 'Mark done: Complete' }).click()
	const toast = page.getByRole('status').filter({ hasText: 'Marked Complete done' })
	await expect(toast).toBeVisible()
	expect(writes).toEqual(['PUT 9001'])
	await toast.screenshot({ path: testInfo.outputPath('folders-done-toast.png') })
	await page.clock.runFor(BEFORE_UNDO_MS)
	await expect(toast).toBeVisible()
	await toast.getByRole('button', { name: 'Undo' }).click()

	await expect.poll(() => writes).toEqual(['PUT 9001', 'DELETE 9001'])
	await expect(list.getByRole('button', { name: 'More for Complete' })).toBeFocused()
	await list.getByRole('button', { name: 'Mark done: Complete' }).click()
	await expect(toast).toBeVisible()
	await page.clock.runFor(BEFORE_UNDO_MS + PAST_UNDO_MS)
	await expect(toast).toBeHidden()
})

// spec: FOLDERS-008.10
test('opens the row\'s menu with Mark done as an accessible, touch-sized bottom sheet on a phone', async ({ page }, testInfo) => {
	await stubLibrary(page)
	await page.setViewportSize({ width: 390, height: 844 })
	const list = await openList(page)
	expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true)

	await list.getByRole('button', { name: 'More for Open' }).click()

	const menu = page.getByRole('dialog', { name: 'Open' })
	await expect(menu.getByRole('button', { name: 'Mark done' })).toBeVisible()
	for (const scheme of SCHEMES) {
		await page.emulateMedia({ colorScheme: scheme })
		await expectAccessible(page, `folder menu on a phone, ${scheme}`)
	}
	await expectTouchTargets(menu, 'folder menu on a phone')
	await page.screenshot({ path: testInfo.outputPath('folders-menu-phone.png') })
})
