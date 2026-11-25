// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { putSettings, resetViewState } from './cull.ts'
import { createFolder, JPEG, RAW, upload } from './files.ts'
import { executeMigration, logIn, occ, sql, trackRequests } from './server.ts'

/** The migration that drops the summaries an older release wrote without previews. */
const PREVIEWS_REPAIR = '000200Date20261125150000'

test.use({ storageState: { cookies: [], origins: [] }, hasTouch: true })

let user = { username: '', password: '' }
let drainRequests = async (): Promise<void> => {}
let photoIds: number[] = []

test.beforeEach(async ({ page }) => {
	drainRequests = trackRequests(page)
	user = { username: `cover-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	await createFolder(page, 'Library', user.username)
	await createFolder(page, 'Library/Photos', user.username)
	await createFolder(page, 'Library/Raws', user.username)
	photoIds = [
		await upload(page, 'Library/Photos/IMG_0001.jpg', JPEG, user.username),
		await upload(page, 'Library/Photos/IMG_0002.jpg', JPEG, user.username),
		await upload(page, 'Library/Raws/IMG_0003.NEF', RAW, user.username),
	]
	await putSettings(page, { libraryRoots: ['/Library'] })
})

// SQLite refuses the deletion while a request of the page still writes, such as a preview render.
test.afterEach(async () => {
	await drainRequests()
	occ(['user:delete', user.username])
})

/** The folder's row on the *Folders* screen, once it is listed. */
async function row(page: Page, name: string): Promise<Locator> {
	const article = page.locator('.folders-screen').getByRole('article', { name })
	await expect(article).toBeVisible()
	return article
}

/** Expects the row's cover to show loaded thumbnails, not the folder icon. */
async function expectLoadedCover(article: Locator) {
	const image = article.locator('.folder-cover img').first()
	await expect(image).toBeVisible()
	await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true)
	await expect(article.locator('.folder-cover__icon')).toHaveCount(0)
}

// spec: FOLDERS-007.18, FOLDERS-005.19
test('shows the cover thumbnails of a folder, also after an update from a summary without previews', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.emulateMedia({ colorScheme: 'dark' })
	await page.goto('/index.php/apps/honeycomb/')

	await expectLoadedCover(await row(page, 'Photos'))
	const raws = await row(page, 'Raws')
	await expect(raws.locator('.folder-cover__icon')).toBeVisible()
	await expect(raws.locator('.folder-cover img')).toHaveCount(0)

	const placeholders = photoIds.map(() => '?').join(', ')
	sql(`UPDATE *PREFIX*honeycomb_folder_summary SET previews = NULL WHERE file_id IN (SELECT parent FROM *PREFIX*filecache WHERE fileid IN (${placeholders}))`, photoIds)
	executeMigration(PREVIEWS_REPAIR)
	await page.reload()

	await expectLoadedCover(await row(page, 'Photos'))
})
