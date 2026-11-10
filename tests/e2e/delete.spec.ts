// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW, requestToken, trashEntry, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const TRASHBIN = `/remote.php/dav/trashbin/${ADMIN.username}`

// spec: DELETE-002.1, DELETE-002.8
test('reviews the rejects, rescues one and moves the rest to the Nextcloud trash bin', async ({ page }) => {
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
	await expect(page.getByRole('status').filter({ hasText: 'Moved 2 photos · 3 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(grid.getByRole('gridcell', { name: 'IMG_0003, JPG only' })).toBeVisible()

	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: { requesttoken: await requestToken(page), Depth: '1' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	const locations = await trash.text()
	for (const file of ['IMG_0001.jpg', 'IMG_0001.NEF', 'IMG_0002.jpg']) {
		expect(locations).toContain(`${folder}/${file}`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0003.jpg`)
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
	const etagResponse = await page.request.fetch(file, { method: 'PROPFIND', headers: { requesttoken, Depth: '0' }, data: '<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>' })
	const etag = /<d:getetag>&quot;(.+?)&quot;<\/d:getetag>/.exec(await etagResponse.text())?.[1]
	expect(etag).toBeDefined()
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
