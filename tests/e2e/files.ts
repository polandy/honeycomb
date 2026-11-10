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

const EXIF_DATE_TIME_LENGTH = 20

/** `jpeg` with an EXIF block whose DateTimeOriginal is `dateTime` (`YYYY:MM:DD HH:MM:SS`), so the photo gets a capture time. */
export function withCaptureTime(jpeg: Buffer, dateTime: string): Buffer {
	const tiff = Buffer.alloc(44 + EXIF_DATE_TIME_LENGTH)
	tiff.write('II', 0, 'latin1')
	tiff.writeUInt16LE(42, 2)
	tiff.writeUInt32LE(8, 4)
	// IFD0: one entry, the pointer to the Exif IFD at offset 26.
	tiff.writeUInt16LE(1, 8)
	tiff.writeUInt16LE(0x8769, 10)
	tiff.writeUInt16LE(4, 12)
	tiff.writeUInt32LE(1, 14)
	tiff.writeUInt32LE(26, 18)
	// Exif IFD: one entry, DateTimeOriginal as ASCII at offset 44.
	tiff.writeUInt16LE(1, 26)
	tiff.writeUInt16LE(0x9003, 28)
	tiff.writeUInt16LE(2, 30)
	tiff.writeUInt32LE(EXIF_DATE_TIME_LENGTH, 32)
	tiff.writeUInt32LE(44, 36)
	tiff.write(dateTime, 44, 'latin1')
	const header = Buffer.from('Exif\0\0', 'latin1')
	const segment = Buffer.alloc(4)
	segment.writeUInt16BE(0xFFE1, 0)
	segment.writeUInt16BE(2 + header.length + tiff.length, 2)
	return Buffer.concat([jpeg.subarray(0, 2), segment, header, tiff, jpeg.subarray(2)])
}

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

/** The trash bin URL of the admin's file deleted from `path`. */
export async function trashEntry(page: Page, path: string): Promise<string> {
	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: { requesttoken: await requestToken(page), Depth: '1' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	const entry = new RegExp(`<d:href>([^<]+)</d:href>(?:(?!</d:response>).)*?<nc:trashbin-original-location>${path}</nc:trashbin-original-location>`, 's').exec(await trash.text())?.[1]
	expect(entry).toBeDefined()
	return entry as string
}
