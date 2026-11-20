// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, request, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'
import { occ, PORT } from './server.ts'

/** OCS share type and permissions of a user share that may only be read. */
const READ_ONLY_SHARE = { shareType: 0, permissions: 1 }

// spec: XMP-003.39, XMP-003.40, XMP-003.41, GRID-001.21
test('writes the picks to XMP files with their count and then has nothing left to write', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Export ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const picked = await upload(page, `${folder}/A.JPG`, JPEG)
	await upload(page, `${folder}/B.JPG`, JPEG)
	const saved = await page.request.put('/index.php/apps/honeycomb/api/v1/flags', { data: { flags: [{ fileId: picked, flag: 'picked', keepRaw: false }] }, headers: await apiHeaders(page) })
	expect(saved.status(), await saved.text()).toBe(200)

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'More', exact: true }).click()
	const entry = page.getByRole('button', { name: /Write picks\/rejects to XMP/ })
	await expect(entry).toContainText('1')
	await entry.click()

	await expect(page.getByRole('status').filter({ hasText: '1 XMP file written' })).toBeVisible()
	const sidecar = await page.request.get(`/remote.php/dav/files/${ADMIN.username}/${folder}/A.JPG.xmp`, { headers: await apiHeaders(page) })
	expect(sidecar.status()).toBe(200)
	expect(await sidecar.text()).toContain('PickLabel')
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await expect(page.getByRole('button', { name: /Write picks\/rejects to XMP/ })).toBeDisabled()
})

// spec: XMP-003.42
test('holds the entry at none in a read-only folder, where no sidecar may be created', async ({ page }) => {
	const sharer = { username: `sharer-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', sharer.username], { OC_PASS: sharer.password })
	const api = await request.newContext({ baseURL: `http://127.0.0.1:${PORT}`, httpCredentials: sharer, extraHTTPHeaders: { 'OCS-APIRequest': 'true' } })
	const shared = `Locked ${randomUUID().slice(0, 8)}`
	const dav = `/remote.php/dav/files/${sharer.username}/${shared}`
	expect((await api.fetch(dav, { method: 'MKCOL' })).status()).toBe(201)
	expect((await api.put(`${dav}/IMG_0001.jpg`, { data: JPEG })).status()).toBeLessThan(300)
	const share = await api.post('/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', { data: { path: `/${shared}`, shareWith: ADMIN.username, ...READ_ONLY_SHARE } })
	expect(share.status(), await share.text()).toBe(200)

	await cullFolder(page, shared)
	await expect(page.getByRole('gridcell')).toHaveCount(1)
	await page.getByRole('button', { name: 'More', exact: true }).click()
	await expect(page.getByRole('button', { name: /Write picks\/rejects to XMP/ })).toBeDisabled()
	await api.dispose()
})
