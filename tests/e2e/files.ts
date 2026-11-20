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
/** A sidecar that states only the pick label, digiKam's 1 rejected and 3 picked. */
export const pickLabel = (label: number) => Buffer.from(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:digiKam="http://www.digikam.org/ns/1.0/" digiKam:PickLabel="${label}"/></rdf:RDF></x:xmpmeta>`)

const EXIF_DATE_TIME_LENGTH = 20

/** `jpeg` with an EXIF block whose DateTimeOriginal is `dateTime` (`YYYY:MM:DD HH:MM:SS`), so the photo gets a capture time, and with `orientation` as its IFD0 Orientation. */
export function withCaptureTime(jpeg: Buffer, dateTime: string, orientation: number | null = null): Buffer {
	const ifd0Entries = orientation === null ? 1 : 2
	const exifIfd = 10 + ifd0Entries * 12 + 4
	const text = exifIfd + 18
	const tiff = Buffer.alloc(text + EXIF_DATE_TIME_LENGTH)
	tiff.write('II', 0, 'latin1')
	tiff.writeUInt16LE(42, 2)
	tiff.writeUInt32LE(8, 4)
	// IFD0: Orientation as SHORT if given, then the pointer to the Exif IFD.
	tiff.writeUInt16LE(ifd0Entries, 8)
	let entry = 10
	if (orientation !== null) {
		tiff.writeUInt16LE(0x0112, entry)
		tiff.writeUInt16LE(3, entry + 2)
		tiff.writeUInt32LE(1, entry + 4)
		tiff.writeUInt16LE(orientation, entry + 8)
		entry += 12
	}
	tiff.writeUInt16LE(0x8769, entry)
	tiff.writeUInt16LE(4, entry + 2)
	tiff.writeUInt32LE(1, entry + 4)
	tiff.writeUInt32LE(exifIfd, entry + 8)
	// Exif IFD: one entry, DateTimeOriginal as ASCII after it.
	tiff.writeUInt16LE(1, exifIfd)
	tiff.writeUInt16LE(0x9003, exifIfd + 2)
	tiff.writeUInt16LE(2, exifIfd + 4)
	tiff.writeUInt32LE(EXIF_DATE_TIME_LENGTH, exifIfd + 6)
	tiff.writeUInt32LE(text, exifIfd + 10)
	tiff.write(dateTime, text, 'latin1')
	return withExif(jpeg, tiff)
}

/** `jpeg` with `tiff` as its EXIF segment, right after the start marker. */
function withExif(jpeg: Buffer, tiff: Buffer): Buffer {
	const header = Buffer.from('Exif\0\0', 'latin1')
	const segment = Buffer.alloc(4)
	segment.writeUInt16BE(0xFFE1, 0)
	segment.writeUInt16BE(2 + header.length + tiff.length, 2)
	return Buffer.concat([jpeg.subarray(0, 2), segment, header, tiff, jpeg.subarray(2)])
}

const davUrl = (path: string) => `/remote.php/dav/files/${ADMIN.username}/${path}`

/** No keep-alive for a test's own requests: Apache closes an idle connection after 5 s, and a request reusing it that instant fails with ECONNRESET. */
const NO_KEEP_ALIVE = { Connection: 'close' }

/** The headers of a test's own request: the page's CSRF token, which the session's writes need, no keep-alive, and `extra`. */
export async function apiHeaders(page: Page, extra: Record<string, string> = {}): Promise<Record<string, string>> {
	return { requesttoken: (await page.locator('head').getAttribute('data-requesttoken')) ?? '', ...NO_KEEP_ALIVE, ...extra }
}

/** Creates a folder in the admin's files; its parent must exist. */
export async function createFolder(page: Page, path: string): Promise<void> {
	const response = await page.request.fetch(davUrl(path), { method: 'MKCOL', headers: await apiHeaders(page) })
	expect(response.status(), await response.text()).toBe(201)
}

/** Uploads `content` to the admin's files with a fixed mtime and returns its file id. */
export async function upload(page: Page, path: string, content: Buffer): Promise<number> {
	const url = davUrl(path)
	const headers = await apiHeaders(page)
	const put = await page.request.put(url, { data: content, headers: { ...headers, 'X-OC-MTime': String(MTIME) } })
	expect(put.status(), await put.text()).toBeLessThan(300)
	const propfind = await page.request.fetch(url, {
		method: 'PROPFIND',
		headers: { ...headers, Depth: '0' },
		data: '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns"><d:prop><oc:fileid/></d:prop></d:propfind>',
	})
	const fileId = /<oc:fileid>(\d+)<\/oc:fileid>/.exec(await propfind.text())?.[1]
	expect(fileId).toBeDefined()
	return Number(fileId)
}

/** The ETag of the admin's file at `path`, as the listing reports it. */
export async function etagOf(page: Page, path: string): Promise<string> {
	const response = await page.request.fetch(davUrl(path), {
		method: 'PROPFIND',
		headers: await apiHeaders(page, { Depth: '0' }),
		data: '<d:propfind xmlns:d="DAV:"><d:prop><d:getetag/></d:prop></d:propfind>',
	})
	const etag = /<d:getetag>&quot;(.+?)&quot;<\/d:getetag>/.exec(await response.text())?.[1]
	expect(etag).toBeDefined()
	return etag as string
}

/** The trash bin URL of the admin's file deleted from `path`. */
export async function trashEntry(page: Page, path: string): Promise<string> {
	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: await apiHeaders(page, { Depth: '1' }),
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	const entry = new RegExp(`<d:href>([^<]+)</d:href>(?:(?!</d:response>).)*?<nc:trashbin-original-location>${path}</nc:trashbin-original-location>`, 's').exec(await trash.text())?.[1]
	expect(entry).toBeDefined()
	return entry as string
}
