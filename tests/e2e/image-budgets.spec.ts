// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { GRID_TIERS, IMAGE_LOADS_IN_FLIGHT, LOUPE_TIER } from '../../src/logic/image-tiers.ts'
import { budgetPhotos } from './budget-photos.ts'
import { resetViewState } from './cull.ts'
import { apiHeaders, createFolder, MTIME, upload } from './files.ts'

const PHOTO_COUNT = 12
const IN_FLIGHT_LIMIT = IMAGE_LOADS_IN_FLIGHT
const GRID_SHARP_TIER = GRID_TIERS.at(-1)!
const TEST_TIMEOUT_MS = 300_000
/** Photos in a folder nobody opens, whose tiers are rendered on the first request only. */
const COLD_COUNT = 2
const IMAGES = '/api/v1/images/'

/** Starts timing at the next click until an `<img>` matching each selector is loaded and a frame has passed; the times by name. */
function startTiming(page: Page, selectors: Record<string, string>) {
	return page.evaluate((selectors) => {
		(window as unknown as { shown: Promise<Record<string, number>> }).shown = new Promise((resolve) => {
			document.addEventListener('click', () => {
				const start = performance.now()
				const times: Record<string, number> = {}
				const check = () => {
					for (const [name, selector] of Object.entries(selectors)) {
						if ([...document.querySelectorAll<HTMLImageElement>(selector)].some((image) => image.complete && image.naturalWidth > 0)) {
							times[name] ??= performance.now() - start
						}
					}
					if (Object.keys(selectors).every((name) => name in times)) {
						requestAnimationFrame(() => resolve(times))
					} else {
						requestAnimationFrame(check)
					}
				}
				requestAnimationFrame(check)
			}, { capture: true, once: true })
		})
	}, selectors)
}

/** The times `startTiming` collected, by the names of its selectors. */
const shown = <Name extends string>(page: Page) => page.evaluate(() => (window as unknown as { shown: Promise<Record<string, number>> }).shown) as Promise<Record<Name, number>>

/** Watches the image requests of `page` by the browser's own clock; `peak()` is the most that were in flight at once. */
async function watchInFlight(page: Page) {
	const session = await page.context().newCDPSession(page)
	await session.send('Network.enable')
	const urls = new Map<string, string>()
	const events: { time: number, change: 1 | -1 }[] = []
	session.on('Network.requestWillBeSent', ({ requestId, request, timestamp }) => {
		if (request.url.includes(IMAGES)) {
			urls.set(requestId, request.url)
			events.push({ time: timestamp, change: 1 })
		}
	})
	const end = ({ requestId, timestamp }: { requestId: string, timestamp: number }) => {
		if (urls.delete(requestId)) {
			events.push({ time: timestamp, change: -1 })
		}
	}
	session.on('Network.loadingFinished', end)
	session.on('Network.loadingFailed', end)
	return () => {
		let open = 0
		let peak = 0
		// An end before a start at the same instant frees its slot first.
		for (const { change } of events.sort((a, b) => a.time - b.time || a.change - b.change)) {
			open += change
			peak = Math.max(peak, open)
		}
		return peak
	}
}

/** Milliseconds the server takes to answer the first request of a tier of a file nobody has opened. */
async function coldRender(page: Page, fileId: number, size: number): Promise<number> {
	const start = performance.now()
	const response = await page.request.get(`/index.php/apps/honeycomb${IMAGES}${fileId}?size=${size}&v=${MTIME}`, { headers: await apiHeaders(page) })
	expect(response.status()).toBe(200)
	await response.body()
	return performance.now() - start
}

// The iPad's pixel ratio: the grid's sharp tier is 1024 px there, not the small one.
test.use({ deviceScaleFactor: 2 })

// spec: GRID-001.15
test('measures the first sharp image, the six loads in flight and the 4096 px tier', async ({ page }) => {
	// Uploading and rendering a dozen 24 MP pairs outlasts the default 30 s; the 120 s waits below bound each step.
	test.setTimeout(TEST_TIMEOUT_MS)
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Budgets ${randomUUID().slice(0, 8)}`
	const coldFolder = `Cold ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await createFolder(page, coldFolder)
	const photos = await budgetPhotos(page, PHOTO_COUNT + COLD_COUNT)
	const cold: number[] = []
	for (const [index, photo] of photos.entries()) {
		const name = `IMG_${String(index + 1).padStart(4, '0')}`
		if (index >= PHOTO_COUNT) {
			cold.push(await upload(page, `${coldFolder}/${name}.jpg`, photo.jpeg))
			continue
		}
		await upload(page, `${folder}/${name}.jpg`, photo.jpeg)
		if (photo.raw !== null) {
			await upload(page, `${folder}/${name}.${photo.raw.extension}`, photo.raw.content)
		}
	}

	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await picker.getByRole('treeitem', { name: folder }).click()
	const peak = await watchInFlight(page)
	await startTiming(page, { small: '.photo-tile__image[src*="size=256"]', sharp: '.photo-tile__image[src*="size=1024"]' })
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()
	const first = await shown<'small' | 'sharp'>(page)

	const last = page.getByRole('gridcell', { name: /^IMG_0012,/ })
	await expect(last.locator('.photo-tile__image')).toHaveAttribute('src', /size=1024/, { timeout: 120_000 })
	expect(peak()).toBeLessThanOrEqual(IN_FLIGHT_LIMIT)

	await startTiming(page, { loupe: 'img[src*="size=4096"]' })
	await last.click()
	const { loupe } = await shown<'loupe'>(page)

	const coldSharp = await coldRender(page, cold[0]!, GRID_SHARP_TIER)
	const coldLoupe = await coldRender(page, cold[1]!, LOUPE_TIER)

	// With the browser's cache off, the folder's previews are on the server but not in the browser.
	await page.goto('/index.php/apps/honeycomb/')
	const noCache = await page.context().newCDPSession(page)
	await noCache.send('Network.setCacheDisabled', { cacheDisabled: true })
	await page.getByRole('dialog', { name: 'Choose folders' }).getByRole('treeitem', { name: folder }).click()
	await startTiming(page, { sharp: '.photo-tile__image[src*="size=1024"]' })
	await page.getByRole('dialog', { name: 'Choose folders' }).getByRole('button', { name: `Cull ${folder}` }).click()
	const rendered = await shown<'sharp'>(page)

	const megabytes = photos.map(({ jpeg }) => (jpeg.length / 1e6).toFixed(1)).join(', ')
	const raws = photos.filter(({ raw }) => raw !== null).length
	const results = {
		'First sharp image, previews rendered, browser cache off': `${rendered.sharp.toFixed(0)} ms (budget < 500 ms)`,
		'Server render of a 1024 px tier, first request': `${coldSharp.toFixed(0)} ms`,
		'Server render of the 4096 px tier, first request': `${coldLoupe.toFixed(0)} ms`,
		'First small preview in a newly opened folder': `${first.small.toFixed(0)} ms`,
		'First sharp image in a newly opened folder, cold': `${first.sharp.toFixed(0)} ms (budget < 500 ms)`,
		'Image loads in flight, peak': `${peak()} (limit ${IN_FLIGHT_LIMIT})`,
		'Loupe 4096 px tier, opened after the warm-up': `${loupe.toFixed(0)} ms`,
	}
	for (const [type, description] of Object.entries(results)) {
		test.info().annotations.push({ type, description })
		process.stdout.write(`${type}: ${description}\n`)
	}
	process.stdout.write(`${PHOTO_COUNT} photos, ${raws} with a RAW, JPEGs of ${megabytes} MB\n`)
})
