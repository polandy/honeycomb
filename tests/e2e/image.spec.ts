// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { JPEG, MTIME, RAW, requestToken, upload } from './files.ts'

/** The natural size of the image at `url`, as the browser decodes it. */
async function naturalSize(page: Page, url: string): Promise<number[]> {
	return page.evaluate(async (src) => {
		const image = new Image()
		image.src = src
		await image.decode()
		return [image.naturalWidth, image.naturalHeight]
	}, url)
}

// spec: IMAGES-001.1, IMAGES-001.3, IMAGES-001.6
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

// spec: IMAGES-001.10
test('queues the previews of a folder in the background', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const fileId = await upload(page, 'IMG_0003.JPG', JPEG)

	const response = await page.request.post('/index.php/apps/honeycomb/api/v1/previews', {
		data: { fileIds: [fileId] },
		headers: { requesttoken: await requestToken(page) },
	})

	expect(response.status()).toBe(202)
})
