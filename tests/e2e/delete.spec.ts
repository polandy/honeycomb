// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { createFolder, etagOf, JPEG, RAW, requestToken, trashEntry, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const TRASHBIN = `/remote.php/dav/trashbin/${ADMIN.username}`

/** A sidecar that states only the pick label, digiKam's 1 rejected and 3 picked. */
const pickLabel = (label: number) => Buffer.from(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:digiKam="http://www.digikam.org/ns/1.0/" digiKam:PickLabel="${label}"/></rdf:RDF></x:xmpmeta>`)

/** The original locations of the files in the trash bin. */
async function trashLocations(page: Page): Promise<string> {
	const trash = await page.request.fetch(`${TRASHBIN}/trash`, {
		method: 'PROPFIND',
		headers: { requesttoken: await requestToken(page), Depth: '1' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	return trash.text()
}

// spec: DELETE-002.1, DELETE-002.8, DELETE-002.15
test('reviews the rejects, rescues one and moves the rest with their sidecars to the Nextcloud trash bin', async ({ page }) => {
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
	await page.getByRole('button', { name: 'Done' }).click()

	await page.getByRole('button', { name: 'Review rejects (3)' }).click()
	const review = page.getByRole('dialog', { name: 'Review rejects' })
	await review.getByRole('button', { name: 'Rescue IMG_0003' }).click()
	await expect(review.getByRole('button', { name: 'Rescue IMG_0003' })).toBeHidden()
	await review.getByRole('button', { name: 'Continue: delete 2' }).click()

	const summary = page.getByRole('dialog', { name: 'Delete 2 photos' })
	await expect(summary.getByRole('list', { name: 'Files that will be deleted' }).getByRole('listitem')).toHaveCount(3)
	await summary.getByRole('button', { name: 'Move 3 files to trash' }).click()

	await expect(summary).toBeHidden()
	await expect(page.getByRole('status').filter({ hasText: 'Moved 2 photos · 6 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(grid.getByRole('gridcell', { name: 'IMG_0003, JPG only' })).toBeVisible()

	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.jpg', 'IMG_0001.NEF', 'IMG_0002.jpg', 'IMG_0001.jpg.xmp', 'IMG_0001.NEF.xmp', 'IMG_0002.jpg.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0003.jpg`)
})

// spec: DELETE-002.19
test('deletes the rejects from the More menu while the flag filter hides them', async ({ page }) => {
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
	await expect(review.getByRole('button', { name: 'Rescue IMG_0001' })).toBeVisible()
	await review.getByRole('button', { name: 'Continue: delete 1' }).click()
	await page.getByRole('dialog', { name: 'Delete 1 photo' }).getByRole('button', { name: 'Move 2 files to trash' }).click()

	await expect(page.getByRole('status').filter({ hasText: 'Moved 1 photo · 2 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeVisible()
	expect(await trashLocations(page)).toContain(`${folder}/IMG_0001.jpg.xmp<`)
})

// spec: DELETE-002.15, DELETE-002.16
test('skips a reject whose sidecar was changed elsewhere to picked, and reports it', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Fresh ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const name of ['IMG_0001', 'IMG_0002']) {
		await upload(page, `${folder}/${name}.jpg`, JPEG)
		await upload(page, `${folder}/${name}.jpg.xmp`, pickLabel(1))
	}

	await cullFolder(page, folder)
	await expect(page.getByRole('button', { name: 'Review rejects (2)' })).toBeVisible()
	await upload(page, `${folder}/IMG_0002.jpg.xmp`, pickLabel(3))

	await page.getByRole('button', { name: 'Review rejects (2)' }).click()
	await page.getByRole('dialog', { name: 'Review rejects' }).getByRole('button', { name: 'Continue: delete 2' }).click()
	await page.getByRole('dialog', { name: 'Delete 2 photos' }).getByRole('button', { name: /^Move \d+ files to trash$/ }).click()

	const report = page.getByRole('dialog', { name: 'Some photos were skipped' })
	await expect(report.getByRole('list', { name: 'Photos skipped' })).toContainText('IMG_0002.jpgIts sidecars do not say rejected')
	await expect(report.getByRole('button', { name: 'Retry failed files' })).toBeDisabled()
	await expect(page.getByRole('status').filter({ hasText: 'Moved 1 photo · 2 files' }).filter({ hasText: '1 photo skipped' })).toBeVisible()
	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.jpg', 'IMG_0001.jpg.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0002.jpg`)
})

// spec: DELETE-001.8
test('a picture restored from the trash bin keeps its file id and its decision', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const requesttoken = await requestToken(page)
	const folder = `Restore ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const path = `${folder}/IMG_0001.jpg`
	const fileId = await upload(page, path, JPEG)
	const file = `/remote.php/dav/files/${ADMIN.username}/${path}`
	const etag = await etagOf(page, path)
	const decision = { fileId, rating: 4, colourLabel: 'green', flag: 'picked', keepRaw: false }
	expect((await page.request.put(`${API}/decisions`, { data: { decisions: [decision] }, headers: { requesttoken } })).status()).toBe(204)

	const trashed = await page.request.post(`${API}/trash`, { data: { pictures: [[{ fileId, etag }]] }, headers: { requesttoken } })
	expect(await trashed.json()).toEqual({ pictures: [[{ fileId, result: 'trashed' }]] })
	const lookup = async () => (await (await page.request.post(`${API}/decisions/lookup`, { data: { fileIds: [fileId] }, headers: { requesttoken } })).json()) as unknown
	expect(await lookup()).toEqual({ decisions: [decision] })

	const entry = await trashEntry(page, path)
	const restored = await page.request.fetch(entry, { method: 'MOVE', headers: { requesttoken, Destination: `${TRASHBIN}/restore/${randomUUID()}` } })
	expect(restored.status(), await restored.text()).toBe(201)

	const back = await page.request.fetch(file, { method: 'PROPFIND', headers: { requesttoken, Depth: '0' }, data: '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>' })
	expect(await back.text()).toContain(`<oc:fileid>${fileId}</oc:fileid>`)
	expect(await lookup()).toEqual({ decisions: [decision] })
})

/** Culls a folder of `IMG_0001.jpg` with a sidecar and `IMG_0002.jpg` without, and picks both, which writes both sidecars at once. */
async function pickBoth(page: Page): Promise<{ folder: string, saved: Promise<unknown> }> {
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
	await page.getByRole('button', { name: 'Pick', exact: true }).click()
	return { folder, saved }
}

/** Confirms *Delete…* of the selection. */
async function deleteSelection(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'Delete…', exact: true }).click()
	await page.getByRole('dialog', { name: 'Delete 2 photos' }).getByRole('button', { name: /^Move \d+ files to trash$/ }).click()
}

// spec: DELETE-002.17
test('deletes chosen photos right after deciding them, with the sidecars honeycomb just wrote and created', async ({ page }) => {
	const { folder } = await pickBoth(page)
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
	const { folder, saved } = await pickBoth(page)
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
