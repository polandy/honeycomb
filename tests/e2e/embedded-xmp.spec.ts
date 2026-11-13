// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createFolder, JPEG, requestToken, upload } from './files.ts'

const PACKET = '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>'

/** The fixture JPEG with an XMP segment right after its start of image. */
function withXmp(packet: string): Buffer {
	const payload = Buffer.concat([Buffer.from('http://ns.adobe.com/xap/1.0/\0'), Buffer.from(packet)])
	const length = Buffer.alloc(2)
	length.writeUInt16BE(payload.length + 2)
	return Buffer.concat([JPEG.subarray(0, 2), Buffer.from([0xFF, 0xE1]), length, payload, JPEG.subarray(2)])
}

// spec: XMP-005.6
test('answers the XMP packet a real JPEG embeds', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Embedded ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const tagged = await upload(page, `${folder}/IMG_0001.JPG`, withXmp(PACKET))
	const plain = await upload(page, `${folder}/IMG_0002.JPG`, JPEG)

	const response = await page.request.post('/index.php/apps/honeycomb/api/v1/embedded-xmp/lookup', {
		data: { fileIds: [tagged, plain] },
		headers: { requesttoken: await requestToken(page) },
	})

	expect(response.status(), await response.text()).toBe(200)
	expect(await response.json()).toEqual({ packets: [
		{ fileId: tagged, result: 'read', content: Buffer.from(PACKET).toString('base64') },
		{ fileId: plain, result: 'none' },
	] })
})
