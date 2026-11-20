// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { budgetPhotos } from './budget-photos.ts'
import { BUDGET_MS, withinBudget } from './budgets.ts'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, upload } from './files.ts'

const PHOTO_COUNT = 3

/** Starts timing at the next key press until `alt`'s loupe tier is loaded and a frame has passed. */
function startTiming(page: Page, alt: string) {
	return page.evaluate((alt) => {
		(window as unknown as { shown: Promise<number> }).shown = new Promise((resolve) => {
			document.addEventListener('keydown', () => {
				const start = performance.now()
				const check = () => {
					const image = document.querySelector<HTMLImageElement>(`img[alt="${alt}"]`)
					if (image?.complete && image.src.includes('size=4096')) {
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
	// Rendering three 24 MP previews outlasts the default 30 s on a busy host; the 60 s polls below bound each wait.
	test.slow()
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Budget ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const measured = (await budgetPhotos(page, PHOTO_COUNT)).map(({ jpeg }) => jpeg)
	for (const [index, photo] of measured.entries()) {
		await upload(page, `${folder}/IMG_000${index + 1}.jpg`, photo)
	}

	await cullFolder(page, folder)
	const loaded = new Set<string>()
	const gridLoaded = new Set<string>()
	page.on('requestfinished', (request) => {
		const url = request.url()
		if (url.includes('/api/v1/images/')) {
			(url.includes('size=4096') ? loaded : gridLoaded).add(new URL(url).pathname)
		}
	})
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	// The shown picture's and every neighbour's loupe tier have arrived; the stage swaps to the shown one's.
	await expect.poll(() => loaded.size, { timeout: 60_000 }).toBe(PHOTO_COUNT)
	// A grid tile still loading is no request of the paging, so every grid tier has arrived too.
	await expect.poll(() => gridLoaded.size, { timeout: 60_000 }).toBe(PHOTO_COUNT)
	await expect(loupe.getByRole('img', { name: 'IMG_0001' })).toHaveAttribute('src', /size=4096/, { timeout: 60_000 })

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
	const result = `${elapsed.toFixed(1)} ms (budget < ${BUDGET_MS.prefetchedLoupe} ms) with JPEGs of ${megabytes} MB`
	test.info().annotations.push({ type: 'Prefetched next loupe image', description: result })
	process.stdout.write(`Prefetched next loupe image: ${result}\n`)
	withinBudget('prefetchedLoupe', elapsed)
})
