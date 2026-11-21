// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { apiHeaders, createFolder, etagOf, exists, JPEG, trashLocations, upload, withSmallTrashBin } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

// spec: MOVE-002.5
test('refuses a replace whose file the trash bin would not keep, and keeps both files', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	const source = `Move ${id}/IMG_0001.jpg`
	const target = `Out ${id}/IMG_0001.jpg`
	await createFolder(page, `Move ${id}`)
	await createFolder(page, `Out ${id}`)
	const fileId = await upload(page, source, JPEG)
	const etag = await etagOf(page, source)
	const replaceId = await upload(page, target, JPEG)
	const replaceEtag = await etagOf(page, target)

	await withSmallTrashBin(async () => {
		const response = await page.request.post(`${API}/move`, {
			data: { pictures: [[{ fileId, etag, path: `/${target}`, replace: { fileId: replaceId, etag: replaceEtag } }]] },
			headers: await apiHeaders(page),
		})
		expect(response.status(), await response.text()).toBe(200)
		expect(await response.json()).toEqual({ pictures: [[{ fileId, result: 'tooLarge', replaced: false }]] })
	})
	expect(await etagOf(page, source)).toBe(etag)
	expect(await etagOf(page, target)).toBe(replaceEtag)
})

// spec: MOVE-002.13
test('replaces for good a file the trash bin would not keep once the replace is marked permanent', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	const source = `Move ${id}/IMG_0001.jpg`
	const target = `Out ${id}/IMG_0001.jpg`
	await createFolder(page, `Move ${id}`)
	await createFolder(page, `Out ${id}`)
	const fileId = await upload(page, source, JPEG)
	const etag = await etagOf(page, source)
	const replaceId = await upload(page, target, JPEG)
	const replaceEtag = await etagOf(page, target)

	await withSmallTrashBin(async () => {
		const response = await page.request.post(`${API}/move`, {
			data: { pictures: [[{ fileId, etag, path: `/${target}`, replace: { fileId: replaceId, etag: replaceEtag, permanent: true } }]] },
			headers: await apiHeaders(page),
		})
		expect(response.status(), await response.text()).toBe(200)
		expect(await response.json()).toEqual({ pictures: [[expect.objectContaining({ fileId, result: 'moved', replaced: true, path: `/${target}` })]] })
	})
	expect(await exists(page, source)).toBe(false)
	expect(await exists(page, target)).toBe(true)
	expect(await trashLocations(page)).not.toContain(`${target}<`)
})
