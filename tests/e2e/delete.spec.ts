// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { apiHeaders, createFolder, etagOf, JPEG, pickLabel, RAW, trashEntry, upload } from './files.ts'
import { IPAD_PORTRAIT, WEBKIT } from './webkit.ts'

// These describe honeycomb with the flags kept out of the sidecars (ADR 0040).
test.beforeEach(async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await putSettings(page, { ...E2E_SETTINGS, writeFlagsToXmp: false })
})

test.afterEach(async ({ page }) => {
	await putSettings(page, E2E_SETTINGS)
})

const API = '/index.php/apps/honeycomb/api/v1'
const TRASHBIN = `/remote.php/dav/trashbin/${ADMIN.username}`

/** The original locations of the files in the trash bin. */
async function trashLocations(page: Page): Promise<string> {
	const trash = await page.request.fetch(`${TRASHBIN}/trash`, {
		method: 'PROPFIND',
		headers: await apiHeaders(page, { Depth: '1' }),
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	return trash.text()
}

// spec: DELETE-002.1, DELETE-002.8, DELETE-002.13
test('reviews the rejects, rescues one and moves the rest to the Nextcloud trash bin, writing no sidecar', { tag: WEBKIT }, async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Delete ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0003.jpg`, JPEG)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(3)
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	for (const name of ['IMG_0001, JPG+NEF', 'IMG_0002, JPG only', 'IMG_0003, JPG only']) {
		await grid.getByRole('gridcell', { name }).click()
	}
	await page.getByRole('button', { name: 'Reject', exact: true }).click()
	await expect(grid).toBeHidden()
	await page.getByRole('dialog', { name: 'Cull finished' }).getByRole('button', { name: 'Done' }).click()
	await page.getByRole('button', { name: 'Done' }).click()

	await page.getByRole('button', { name: 'Review rejects: 3' }).click()
	const review = page.getByRole('dialog', { name: 'Review rejects' })
	await review.getByRole('button', { name: /^IMG_0003/ }).click()
	await expect(review.getByRole('button', { name: /^IMG_0003/ })).toBeHidden()
	await review.getByRole('button', { name: 'Continue: delete 2' }).click()

	const summary = page.getByRole('dialog', { name: 'Delete 2 photos' })
	await expect(summary.getByRole('list', { name: 'Files that will be deleted' }).getByRole('listitem')).toHaveCount(3)
	let release = () => {}
	const held = new Promise<void>((resolve) => (release = resolve))
	await page.route('**/apps/honeycomb/api/v1/trash', async (route) => {
		await held
		await route.continue()
	})
	await summary.getByRole('button', { name: 'Move 3 files to trash' }).click()
	await expect(summary.getByRole('button', { name: 'Moving to trash…' })).toBeDisabled()
	await expect(summary.getByText('0 of 2 photos sent')).toBeVisible()
	release()

	await expect(summary).toBeHidden()
	await expect(page.getByRole('status').filter({ hasText: 'Moved 2 photos · 3 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(grid.getByRole('gridcell', { name: 'IMG_0003, JPG only' })).toBeVisible()

	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.jpg', 'IMG_0001.NEF', 'IMG_0002.jpg']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0001.NEF.xmp<`)
	expect(locations).not.toContain(`${folder}/IMG_0003.jpg`)
})

// spec: DELETE-002.19
test('deletes the rejects from the More menu while the flag filter hides them', { tag: IPAD_PORTRAIT }, async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Menu ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.jpg.xmp`, pickLabel(1))
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await page.getByRole('button', { name: 'More', exact: true }).click()
	const item = page.getByRole('button', { name: /^Review rejects 1/ })
	await expect(item.locator('kbd')).toHaveText('Ctrl+Backspace')
	await item.click()

	const review = page.getByRole('dialog', { name: 'Review rejects' })
	await expect(review.getByRole('button', { name: /^IMG_0001/ })).toBeVisible()
	await review.getByRole('button', { name: 'Continue: delete 1' }).click()
	await page.getByRole('dialog', { name: 'Delete 1 photo' }).getByRole('button', { name: 'Move 2 files to trash' }).click()

	await expect(page.getByRole('status').filter({ hasText: 'Moved 1 photo · 2 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeVisible()
	expect(await trashLocations(page)).toContain(`${folder}/IMG_0001.jpg.xmp<`)
})

// spec: DELETE-002.16, DELETE-002.26
test('skips a reject another user picked meanwhile and reports it, but deletes one whose sidecar another program picked', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Fresh ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileIds: number[] = []
	for (const name of ['IMG_0001', 'IMG_0002']) {
		fileIds.push(await upload(page, `${folder}/${name}.jpg`, JPEG))
		await upload(page, `${folder}/${name}.jpg.xmp`, pickLabel(1))
	}

	const takenOver = page.waitForResponse((response) => response.url().endsWith('/api/v1/flags/take-over') && response.ok())
	await cullFolder(page, folder)
	await expect(page.getByRole('button', { name: 'Review rejects: 2' })).toBeVisible()
	await takenOver
	const picked = await page.request.put(`${API}/flags`, { data: { flags: [{ fileId: fileIds[1], flag: 'picked', keepRaw: false }] }, headers: await apiHeaders(page) })
	expect(picked.status()).toBe(200)
	await upload(page, `${folder}/IMG_0001.jpg.xmp`, pickLabel(3))

	await page.getByRole('button', { name: 'Review rejects: 2' }).click()
	await page.getByRole('dialog', { name: 'Review rejects' }).getByRole('button', { name: 'Continue: delete 2' }).click()
	await page.getByRole('dialog', { name: 'Delete 2 photos' }).getByRole('button', { name: /^Move \d+ files to trash$/ }).click()

	const report = page.getByRole('dialog', { name: 'Some photos were skipped' })
	await expect(report.getByRole('list', { name: 'Photos skipped' })).toContainText('IMG_0002.jpgNo longer rejected')
	await expect(report.getByRole('button', { name: 'Retry failed files' })).toBeDisabled()
	await expect(page.getByRole('status').filter({ hasText: 'Moved 1 photo · 2 files' }).filter({ hasText: '1 photo skipped' })).toBeVisible()
	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.jpg', 'IMG_0001.jpg.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0002.jpg`)
})

// spec: DELETE-002.27
test('deletes nothing of a folder it could not list again, asks nothing and reports the rejects as skipped', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Unlisted ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const name of ['IMG_0001', 'IMG_0002']) {
		await upload(page, `${folder}/${name}.jpg`, JPEG)
		await upload(page, `${folder}/${name}.jpg.xmp`, pickLabel(1))
	}
	await cullFolder(page, folder)
	await expect(page.getByRole('button', { name: 'Review rejects: 2' })).toBeVisible()
	await page.route('**/apps/honeycomb/api/v1/entries**', (route) => route.fulfill({ status: 500 }))

	await page.getByRole('button', { name: 'Review rejects: 2' }).click()
	await page.getByRole('dialog', { name: 'Review rejects' }).getByRole('button', { name: 'Continue: delete 2' }).click()
	await page.getByRole('dialog', { name: 'Delete 2 photos' }).getByRole('button', { name: /^Move \d+ files to trash$/ }).click()

	const report = page.getByRole('dialog', { name: 'Some photos were skipped' })
	await expect(report.getByRole('list', { name: 'Photos skipped' })).toContainText('IMG_0001.jpgIts folder could not be listed again')
	await expect(page.getByRole('status').filter({ hasText: '2 photos skipped' })).toBeVisible()
	expect(await trashLocations(page)).not.toContain(`${folder}/`)
})

// spec: DELETE-002.11
test('deletes nothing when the trash request fails, and the toast says so', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Failed ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.jpg.xmp`, pickLabel(1))
	await cullFolder(page, folder)
	await page.route('**/apps/honeycomb/api/v1/trash', (route) => route.fulfill({ status: 500 }))

	await page.getByRole('button', { name: 'Review rejects: 1' }).click()
	await page.getByRole('dialog', { name: 'Review rejects' }).getByRole('button', { name: 'Continue: delete 1' }).click()
	await page.getByRole('dialog', { name: 'Delete 1 photo' }).getByRole('button', { name: 'Move 2 files to trash' }).click()

	await expect(page.getByRole('alert').filter({ hasText: 'Could not delete the photos; reload the folder to see what changed.' })).toBeVisible()
	await expect(page.getByRole('button', { name: 'Review rejects: 1' })).toBeVisible()
	expect(await trashLocations(page)).not.toContain(`${folder}/`)
})

// spec: DELETE-001.15
test('a picture restored from the trash bin keeps its file id but not its flag, whose row went with it', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const headers = await apiHeaders(page)
	const id = randomUUID().slice(0, 8)
	const folder = `Restore ${id}`
	await createFolder(page, folder)
	// Nextcloud puts a second file of one name trashed in the same second over the first (ADR 0037).
	const path = `${folder}/IMG_${id}.jpg`
	const fileId = await upload(page, path, JPEG)
	const file = `/remote.php/dav/files/${ADMIN.username}/${path}`
	const etag = await etagOf(page, path)
	expect((await page.request.put(`${API}/flags`, { data: { flags: [{ fileId, flag: 'picked', keepRaw: false }] }, headers })).status()).toBe(200)

	const trashed = await page.request.post(`${API}/trash`, { data: { pictures: [[{ fileId, etag }]] }, headers })
	expect(await trashed.json()).toEqual({ pictures: [[{ fileId, result: 'trashed' }]] })
	const flagOf = async () => ((await (await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers })).json()) as { entries: { fileId: number, flag: string | null }[] }).entries.find((entry) => entry.fileId === fileId)?.flag

	const entry = await trashEntry(page, path)
	const restored = await page.request.fetch(entry, { method: 'MOVE', headers: { ...headers, Destination: `${TRASHBIN}/restore/${randomUUID()}` } })
	expect(restored.status(), await restored.text()).toBe(201)

	const back = await page.request.fetch(file, { method: 'PROPFIND', headers: { ...headers, Depth: '0' }, data: '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>' })
	expect(await back.text()).toContain(`<oc:fileid>${fileId}</oc:fileid>`)
	expect(await flagOf()).toBeNull()
})

// spec: DELETE-001.13
test('two photos of one name from two folders, trashed in one request, can both be restored', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const headers = await apiHeaders(page)
	const id = randomUUID().slice(0, 8)
	const files = []
	for (const folder of [`Same name ${id} A`, `Same name ${id} B`]) {
		await createFolder(page, folder)
		const path = `${folder}/IMG_${id}.jpg`
		files.push({ path, fileId: await upload(page, path, JPEG), etag: await etagOf(page, path) })
	}

	const pictures = files.map(({ fileId, etag }) => [{ fileId, etag }])
	const trashed = await page.request.post(`${API}/trash`, { data: { pictures }, headers })
	expect(await trashed.json()).toEqual({ pictures: files.map(({ fileId }) => [{ fileId, result: 'trashed' }]) })

	for (const { path, fileId } of files) {
		const entry = await trashEntry(page, path)
		const restored = await page.request.fetch(entry, { method: 'MOVE', headers: { ...headers, Destination: `${TRASHBIN}/restore/${randomUUID()}` } })
		expect(restored.status(), await restored.text()).toBe(201)
		const back = await page.request.fetch(`/remote.php/dav/files/${ADMIN.username}/${path}`, { method: 'PROPFIND', headers: { ...headers, Depth: '0' }, data: '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>' })
		expect(await back.text()).toContain(`<oc:fileid>${fileId}</oc:fileid>`)
	}
})

/** Culls a folder of `IMG_0001.jpg` with a sidecar and `IMG_0002.jpg` without, and rates both, which writes both sidecars at once. */
async function rateBoth(page: Page): Promise<{ folder: string, saved: Promise<unknown> }> {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Own writes ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.jpg.xmp`, pickLabel(0))
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	for (const name of ['IMG_0001, JPG only', 'IMG_0002, JPG only']) {
		await grid.getByRole('gridcell', { name }).click()
	}
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/sidecars') && response.request().method() === 'PUT')
	await page.getByRole('button', { name: 'Rate 3 stars' }).click()
	return { folder, saved }
}

/** Confirms *Delete…* of the selection. */
async function deleteSelection(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Delete…', exact: true }).click()
	await page.getByRole('dialog', { name: 'Delete 2 photos' }).getByRole('button', { name: /^Move \d+ files to trash$/ }).click()
}

// spec: DELETE-002.17
test('deletes chosen photos right after deciding them, with the sidecars honeycomb just wrote and created', async ({ page }) => {
	const { folder } = await rateBoth(page)
	await deleteSelection(page)

	await expect(page.getByRole('status').filter({ hasText: 'Moved 2 photos · 4 files' })).toBeVisible()
	await expect(page.getByRole('dialog', { name: 'Deletion finished with errors' })).toBeHidden()
	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.jpg', 'IMG_0001.jpg.xmp', 'IMG_0002.jpg', 'IMG_0002.jpg.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
})

// spec: DELETE-002.18
test('keeps a chosen photo whose sidecar another program changed after honeycomb wrote it', async ({ page }) => {
	const { folder, saved } = await rateBoth(page)
	await saved
	await upload(page, `${folder}/IMG_0001.jpg.xmp`, pickLabel(1))
	await deleteSelection(page)

	const report = page.getByRole('dialog', { name: 'Deletion finished with errors' })
	await expect(report.getByRole('list', { name: 'Files that failed' })).toContainText('IMG_0001.jpg.xmpFile changed since the folder was listed')
	const locations = await trashLocations(page)
	for (const file of ['IMG_0002.jpg', 'IMG_0002.jpg.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0001.jpg`)
})
