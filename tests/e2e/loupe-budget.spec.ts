// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, upload } from './files.ts'

const PHOTO_COUNT = 3
/** A folder of the owner's own JPEGs to measure with instead of the drawn ones. */
const PHOTOS = process.env.HONEYCOMB_BUDGET_PHOTOS

/** A 24 MP JPEG, 6000 × 4000, drawn in the browser: a gradient under a seeded noise tile. */
async function drawnPhoto(page: Page, seed: number): Promise<Buffer> {
	const base64 = await page.evaluate(async (seed) => {
		const tile = new OffscreenCanvas(509, 509)
		const noise = new ImageData(tile.width, tile.height)
		let state = seed
		for (let i = 0; i < noise.data.length; i++) {
			state = (Math.imul(state, 1103515245) + 12345) >>> 0
			noise.data[i] = i % 4 === 3 ? 64 : state >>> 24
		}
		tile.getContext('2d')!.putImageData(noise, 0, 0)

		const canvas = new OffscreenCanvas(6000, 4000)
		const context = canvas.getContext('2d')!
		const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height)
		gradient.addColorStop(0, `hsl(${seed * 97 % 360} 60% 30%)`)
		gradient.addColorStop(1, `hsl(${(seed * 97 + 140) % 360} 60% 70%)`)
		context.fillStyle = gradient
		context.fillRect(0, 0, canvas.width, canvas.height)
		context.fillStyle = context.createPattern(tile, 'repeat')!
		context.fillRect(0, 0, canvas.width, canvas.height)

		const bytes = new Uint8Array(await (await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 })).arrayBuffer())
		let binary = ''
		for (let start = 0; start < bytes.length; start += 0x8000) {
			binary += String.fromCharCode(...bytes.subarray(start, start + 0x8000))
		}
		return btoa(binary)
	}, seed)
	return Buffer.from(base64, 'base64')
}

/** The photos to measure with: the first JPEGs of `PHOTOS`, else drawn ones. */
async function photos(page: Page): Promise<Buffer[]> {
	if (PHOTOS !== undefined) {
		const names = readdirSync(PHOTOS).filter((name) => /\.jpe?g$/i.test(name)).sort().slice(0, PHOTO_COUNT)
		expect(names, `JPEGs in ${PHOTOS}`).toHaveLength(PHOTO_COUNT)
		return names.map((name) => readFileSync(join(PHOTOS, name)))
	}
	const drawn: Buffer[] = []
	for (let seed = 1; seed <= PHOTO_COUNT; seed++) {
		drawn.push(await drawnPhoto(page, seed))
	}
	return drawn
}

/** Starts timing at the next key press until `alt`'s loupe tier is loaded and a frame has passed. */
function startTiming(page: Page, alt: string) {
	return page.evaluate((alt) => {
		(window as unknown as { shown: Promise<number> }).shown = new Promise((resolve) => {
			document.addEventListener('keydown', () => {
				const start = performance.now()
				const check = () => {
					const image = document.querySelector<HTMLImageElement>(`img[alt="${alt}"]`)
					if (image?.complete && image.src.includes('size=2048')) {
						requestAnimationFrame(() => resolve(performance.now() - start))
					} else {
						requestAnimationFrame(check)
					}
				}
				requestAnimationFrame(check)
			}, { capture: true, once: true })
		})
	}, alt)
}

// spec: LOUPE-001.12
test('shows a prefetched 24 MP neighbour without a request when paging', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Budget ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const measured = await photos(page)
	for (const [index, photo] of measured.entries()) {
		await upload(page, `${folder}/IMG_000${index + 1}.jpg`, photo)
	}

	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	await loupe.getByRole('button', { name: 'Toggle info panel' }).click()
	await expect(loupe.getByText(`${PHOTO_COUNT - 1} of ${PHOTO_COUNT - 1} neighbours loaded`)).toBeVisible({ timeout: 60_000 })
	// The counter leaves out the shown picture; the stage swaps to its loupe tier once that has loaded.
	await expect(loupe.getByRole('img', { name: 'IMG_0001' })).toHaveAttribute('src', /size=2048/, { timeout: 60_000 })

	const requests: string[] = []
	const network = await page.context().newCDPSession(page)
	await network.send('Network.enable')
	// A disk-cache hit also reaches Playwright's request event; only a network fetch counts.
	network.on('Network.responseReceived', ({ response }) => {
		if (response.url.includes('/api/v1/images/') && response.fromDiskCache !== true && response.fromPrefetchCache !== true) {
			requests.push(response.url)
		}
	})
	await startTiming(page, 'IMG_0002')
	await page.keyboard.press('ArrowRight')
	const elapsed = await page.evaluate(() => (window as unknown as { shown: Promise<number> }).shown)

	expect(requests).toEqual([])
	const megabytes = measured.map((photo) => (photo.length / 1e6).toFixed(1)).join(', ')
	const result = `${elapsed.toFixed(1)} ms (budget < 100 ms) with JPEGs of ${megabytes} MB`
	test.info().annotations.push({ type: 'Prefetched next loupe image', description: result })
	process.stdout.write(`Prefetched next loupe image: ${result}\n`)
})
