// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ADMIN } from './admin.ts'

const MTIME = 1_700_000_000
const JPEG = readFileSync('tests/fixtures/images/landscape-600x400.jpg')
/** A stand-in RAW: a TIFF header and sensor bytes around the embedded JPEG preview. */
const RAW = Buffer.concat([Buffer.from('II*\0'), Buffer.alloc(512, 0x11), JPEG, Buffer.alloc(512, 0x22)])

/** The CSRF token of the logged-in page, which the session's WebDAV and POST requests need. */
async function requestToken(page: Page): Promise<string> {
	return (await page.locator('head').getAttribute('data-requesttoken')) ?? ''
}

/** Uploads `content` to the admin's files with a fixed mtime and returns its file id. */
async function upload(page: Page, name: string, content: Buffer): Promise<number> {
	const url = `/remote.php/dav/files/${ADMIN.username}/${name}`
	const requesttoken = await requestToken(page)
	const put = await page.request.put(url, { data: content, headers: { requesttoken, 'X-OC-MTime': String(MTIME) } })
	expect(put.status(), await put.text()).toBeLessThan(300)
	const propfind = await page.request.fetch(url, {
		method: 'PROPFIND',
		headers: { requesttoken, Depth: '0' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>',
	})
	const fileId = /<oc:fileid>(\d+)<\/oc:fileid>/.exec(await propfind.text())?.[1]
	expect(fileId).toBeDefined()
	return Number(fileId)
}

/** The natural size of the image at `url`, as the browser decodes it. */
async function naturalSize(page: Page, url: string): Promise<number[]> {
	return page.evaluate(async (src) => {
		const image = new Image()
		image.src = src
		await image.decode()
		return [image.naturalWidth, image.naturalHeight]
	}, url)
}

test('serves a JPEG and a RAW-only picture under immutable URLs', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	for (const [name, content] of [['IMG_0001.JPG', JPEG], ['IMG_0002.NEF', RAW]] as const) {
		const url = `/index.php/apps/honeycomb/api/v1/images/${await upload(page, name, content)}?size=256&v=${MTIME}`

		const response = await page.request.get(url)
		expect(response.status(), name).toBe(200)
		expect(response.headers()['content-type']).toMatch(/^image\//)
		expect(response.headers()['cache-control']).toBe('private, max-age=31536000, immutable')
		expect(await naturalSize(page, url), name).toEqual([256, 171])

		const revisit = await page.request.get(url, { headers: { 'If-None-Match': response.headers().etag ?? '' } })
		expect(revisit.status(), name).toBe(304)
	}
})

test('queues the previews of a folder in the background', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const fileId = await upload(page, 'IMG_0003.JPG', JPEG)

	const response = await page.request.post('/index.php/apps/honeycomb/api/v1/previews', {
		data: { fileIds: [fileId] },
		headers: { requesttoken: await requestToken(page) },
	})

	expect(response.status()).toBe(202)
})
