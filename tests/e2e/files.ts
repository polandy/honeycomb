// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { ADMIN } from './admin.ts'

export const MTIME = 1_700_000_000
export const JPEG = readFileSync('tests/fixtures/images/landscape-600x400.jpg')
/** A stand-in RAW: a TIFF header and sensor bytes around the embedded JPEG preview. */
export const RAW = Buffer.concat([Buffer.from('II*\0'), Buffer.alloc(512, 0x11), JPEG, Buffer.alloc(512, 0x22)])

const davUrl = (path: string) => `/remote.php/dav/files/${ADMIN.username}/${path}`

/** The CSRF token of the logged-in page, which the session's WebDAV and POST requests need. */
export async function requestToken(page: Page): Promise<string> {
	return (await page.locator('head').getAttribute('data-requesttoken')) ?? ''
}

/** Creates a folder in the admin's files; its parent must exist. */
export async function createFolder(page: Page, path: string): Promise<void> {
	const response = await page.request.fetch(davUrl(path), { method: 'MKCOL', headers: { requesttoken: await requestToken(page) } })
	expect(response.status(), await response.text()).toBe(201)
}

/** Uploads `content` to the admin's files with a fixed mtime and returns its file id. */
export async function upload(page: Page, path: string, content: Buffer): Promise<number> {
	const url = davUrl(path)
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
