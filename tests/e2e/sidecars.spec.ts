// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { createFolder, requestToken, upload } from './files.ts'

const api = '/index.php/apps/honeycomb/api/v1/sidecars'

async function lookup(page: Page, fileId: number) {
	const response = await page.request.post(`${api}/lookup`, { data: { fileIds: [fileId] }, headers: { requesttoken: await requestToken(page) } })
	expect(response.status(), await response.text()).toBe(200)
	return (await response.json()).sidecars[0]
}

/** The bytes of each version the Versions app keeps of the file. */
async function versionContents(page: Page, fileId: number): Promise<string[]> {
	const requesttoken = await requestToken(page)
	const url = `/remote.php/dav/versions/${ADMIN.username}/versions/${fileId}`
	const propfind = await page.request.fetch(url, { method: 'PROPFIND', headers: { requesttoken, Depth: '1' } })
	expect(propfind.status(), await propfind.text()).toBe(207)
	const hrefs = [...(await propfind.text()).matchAll(/<d:href>([^<]+)<\/d:href>/g)].flatMap(([, href]) => href === undefined || href.endsWith(`/${fileId}/`) ? [] : [href])
	return Promise.all(hrefs.map(async (href) => (await page.request.get(href, { headers: { requesttoken } })).text()))
}

// spec: XMP-002.9
test('saves new bytes to a sidecar under the same file id and keeps the old ones as a version', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Sidecars ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileId = await upload(page, `${folder}/IMG_0001.NEF.xmp`, Buffer.from('<x:xmpmeta/>'))
	const read = await lookup(page, fileId)
	expect(Buffer.from(read.content, 'base64').toString()).toBe('<x:xmpmeta/>')

	const content = Buffer.from('<x:xmpmeta>saved</x:xmpmeta>').toString('base64')
	const response = await page.request.put(api, {
		data: { sidecars: [{ fileId, etag: read.etag, size: read.size, content }] },
		headers: { requesttoken: await requestToken(page) },
	})
	expect(response.status(), await response.text()).toBe(200)
	const [saved] = (await response.json()).sidecars
	expect(saved).toMatchObject({ result: 'saved', fileId })

	expect(await lookup(page, fileId)).toMatchObject({ result: 'read', fileId, content, etag: saved.etag })
	expect(await versionContents(page, fileId)).toContain('<x:xmpmeta/>')
})
