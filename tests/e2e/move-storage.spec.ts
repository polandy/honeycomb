// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { APIRequestContext } from '@playwright/test'

import { expect, request, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW } from './files.ts'
import { occ, PORT } from './server.ts'

const SCREENSHOT_VIEWPORTS = { 'ipad-mini-landscape': { width: 1133, height: 744 }, 'pixel-portrait': { width: 427, height: 952 } }
/** OCS share type and permissions for a user share with full rights. */
const USER_SHARE = { shareType: 0, permissions: 31 }

/** Creates a user who shares `folder`, holding one JPG+NEF pair, with the admin. */
async function shareWithAdmin(folder: string): Promise<APIRequestContext> {
	const sharer = { username: `sharer-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', sharer.username], { OC_PASS: sharer.password })
	const api = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, httpCredentials: sharer, extraHTTPHeaders: { 'OCS-APIRequest': 'true' } })
	const dav = `/remote.php/dav/files/${sharer.username}/${folder}`
	expect((await api.fetch(dav, { method: 'MKCOL' })).status()).toBe(201)
	expect((await api.put(`${dav}/IMG_0001.jpg`, { data: JPEG })).status()).toBeLessThan(300)
	expect((await api.put(`${dav}/IMG_0001.NEF`, { data: RAW })).status()).toBeLessThan(300)
	const share = await api.post('/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', { data: { path: `/${folder}`, shareWith: ADMIN.username, ...USER_SHARE } })
	expect(share.status(), await share.text()).toBe(200)
	return api
}

// spec: MOVE-004.16
test('keeps pictures in an incoming share out of a move to the own files', async ({ page }, testInfo) => {
	const id = randomUUID().slice(0, 8)
	const shared = `Shared ${id}`
	const target = `Out ${id}`
	const api = await shareWithAdmin(shared)
	await page.goto('/index.php/apps/honeycomb/')
	await createFolder(page, target)

	await cullFolder(page, shared)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' }).click()
	await page.getByRole('button', { name: 'Move…', exact: true }).click()

	const dialog = page.getByRole('dialog', { name: 'Move 1 photo' })
	await dialog.getByRole('button', { name: 'Browse…' }).click()
	const browse = page.getByRole('dialog', { name: 'Choose the target folder' })
	await browse.getByRole('option', { name: target }).click()
	await browse.getByRole('button', { name: 'Choose' }).click()
	await expect(dialog.getByText('IMG_0001 is not moved: the target is outside its shared folder or storage')).toBeVisible()
	await expect(dialog.getByRole('button', { name: /^Move/ })).toBeDisabled()
	for (const [device, viewport] of Object.entries(SCREENSHOT_VIEWPORTS)) {
		await page.setViewportSize(viewport)
		await page.screenshot({ path: testInfo.outputPath(`move-leaves-share-${device}.png`), animations: 'disabled' })
	}
	await api.dispose()
})
