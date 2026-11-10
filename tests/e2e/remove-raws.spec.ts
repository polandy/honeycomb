// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW, requestToken, upload } from './files.ts'

const SIDECAR = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"/>')

test('removes only the RAW and its own sidecar of each pair not kept, after one is kept in the summary', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Raws ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const name of ['IMG_0001', 'IMG_0002']) {
		await upload(page, `${folder}/${name}.jpg`, JPEG)
		await upload(page, `${folder}/${name}.NEF`, RAW)
	}
	await upload(page, `${folder}/IMG_0001.NEF.xmp`, SIDECAR)
	await upload(page, `${folder}/IMG_0001.xmp`, SIDECAR)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: /Remove RAWs… 2/ }).click()

	const summary = page.getByRole('dialog', { name: /^Remove the RAWs? of/ })
	await expect(summary).toHaveAccessibleName('Remove the RAWs of 2 photos')
	await summary.getByRole('button', { name: 'Keep RAW: IMG_0002' }).click()
	await expect(summary).toHaveAccessibleName('Remove the RAW of 1 photo')
	await expect(summary.getByRole('button', { name: 'Remove RAW: IMG_0002' })).toBeVisible()
	await summary.getByRole('button', { name: 'Move 2 files to trash' }).click()

	await expect(summary).toBeHidden()
	await expect(page.getByRole('status').filter({ hasText: 'Removed the RAWs of 1 photo · 2 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0001, JPG only' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: /^IMG_0002, JPG\+NEF/ })).toBeVisible()

	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: { requesttoken: await requestToken(page), Depth: '1' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	const locations = await trash.text()
	for (const file of ['IMG_0001.NEF', 'IMG_0001.NEF.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	for (const file of ['IMG_0001.jpg', 'IMG_0001.xmp', 'IMG_0002.NEF']) {
		expect(locations).not.toContain(`${folder}/${file}<`)
	}
})
