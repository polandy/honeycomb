// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, etagOf, JPEG, pickLabel, RAW, trashEntry, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

// spec: XMP-009.13, XMP-009.11, XMP-009.6
test('opens from the navigation, lists the orphaned sidecars and moves them to the trash bin once confirmed', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Orphans ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.xmp`, pickLabel(1))
	await upload(page, `${folder}/IMG_0002.CR2.xmp`, pickLabel(1))
	await cullFolder(page, folder)

	await page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: 'Orphaned sidecars' }).click()
	await expect(page).toHaveURL(/\/apps\/honeycomb\/orphaned-sidecars$/)
	await page.getByRole('treeitem', { name: folder }).click()
	await page.getByRole('button', { name: 'Find orphaned sidecars' }).click()

	await expect(page.locator('.orphaned-sidecars__folder summary')).toHaveText([new RegExp(`^/${folder} – 1 sidecar, `)])
	await page.getByRole('button', { name: 'Move 1 sidecar to trash' }).click()

	await expect(page.getByText('1 moved to the trash bin, 0 skipped')).toBeVisible()
	await trashEntry(page, `${folder}/IMG_0002.CR2.xmp`)
	await etagOf(page, `${folder}/IMG_0001.xmp`)
})

// spec: XMP-009.7
test('skips a listed sidecar whose RAW file arrived before the confirmation', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/orphaned-sidecars')
	const folder = `Orphans ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileId = await upload(page, `${folder}/IMG_0003.CR2.xmp`, pickLabel(1))
	const headers = await apiHeaders(page)
	const scan = await page.request.get(`${API}/sidecars/orphaned`, { params: { path: `/${folder}`, cursor: '' }, headers })
	const listed = (await scan.json() as { sidecars: { fileId: number, etag: string }[] }).sidecars
	expect(listed.map((sidecar) => sidecar.fileId)).toEqual([fileId])

	await upload(page, `${folder}/IMG_0003.CR2`, RAW)
	const trash = await page.request.post(`${API}/sidecars/orphaned/trash`, { data: { sidecars: listed.map(({ fileId: id, etag }) => ({ fileId: id, etag })) }, headers })

	expect(await trash.json()).toEqual({ sidecars: [{ fileId, result: 'notOrphaned' }] })
	await etagOf(page, `${folder}/IMG_0003.CR2.xmp`)
})
