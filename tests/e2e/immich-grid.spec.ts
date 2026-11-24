// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { resetViewState } from './cull.ts'
import { logIn, occ } from './server.ts'

/** The user the e2e connections file gives two connections to the stub Immich (`tests/fixtures/immich/e2e/`). */
const ALICE = { username: 'alice', password: 'honeycomb-e2e-alice-password' }
/** The listing route of the connection whose key the stub takes; its library holds 3,660 uploads, `PXL_E2E_0001` the newest. */
const LISTING = '**/api/v1/immich/family/assets'
/** The listing's page size, so the 101st upload is the second page's first. */
const PAGE_SIZE = 100

/** Opens honeycomb as Alice on the Immich source, Family phones first, and waits for its first page. */
async function openFamily(page: Page): Promise<Locator> {
	await page.goto('/index.php/apps/honeycomb/')
	await page.getByRole('button', { name: 'Immich', exact: true }).click()
	const main = page.getByRole('main')
	await expect(main).toContainText('3,660 of 3,660 pictures')
	await expect(tile(page, 1)).toBeVisible()
	return main
}

/** The grid's tile of the n-th newest upload. */
function tile(page: Page, n: number): Locator {
	return page.getByRole('gridcell', { name: new RegExp(`^${uploadName(n)},`) })
}

function uploadName(n: number): string {
	return `PXL_E2E_${String(n).padStart(4, '0')}`
}

/** Opens the newest upload in the loupe and dismisses the guide. */
async function openLoupe(page: Page): Promise<Locator> {
	await tile(page, 1).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await expect(loupe.getByRole('heading', { name: uploadName(1) })).toBeVisible()
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	return loupe
}

test.describe('the grid and the loupe of an Immich connection', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test.beforeAll(() => {
		occ(['user:add', '--password-from-env', ALICE.username], { OC_PASS: ALICE.password })
	})

	test.afterAll(() => {
		occ(['user:delete', ALICE.username])
	})

	test.beforeEach(async ({ page }) => {
		await logIn(page, ALICE)
		await page.goto('/index.php/apps/honeycomb/')
		await resetViewState(page)
	})

	// spec: IMMICH-002.6, IMMICH-002.7, IMMICH-002.13
	test('loads the first page on open, previews only the shown tiles and the next page at the end of the grid', async ({ page }) => {
		const listings: string[] = []
		page.on('request', (request) => {
			if (request.url().endsWith('/api/v1/immich/family/assets')) {
				listings.push(request.url())
			}
		})
		const main = await openFamily(page)

		const previews = main.locator('img[src*="/image?size=thumbnail"]')
		// A tile mounts its image only once the preview has loaded, after the tile itself shows.
		await expect(previews.first()).toBeAttached()
		expect(await previews.count()).toBeLessThan(PAGE_SIZE)
		await expect(tile(page, PAGE_SIZE + 1)).toHaveCount(0)
		expect(listings).toHaveLength(1)

		const next = page.waitForResponse(LISTING)
		await main.getByRole('grid').hover()
		await page.mouse.wheel(0, 1_000_000)
		expect((await next).status()).toBe(200)
		await page.mouse.wheel(0, 1_000)
		await expect(tile(page, PAGE_SIZE + 1)).toBeVisible()
		expect(listings).toHaveLength(2)
	})

	// spec: IMMICH-002.16
	test('shows tiles and the loupe through honeycomb, never from Immich', async ({ page }) => {
		const hosts = new Set<string>()
		page.on('request', (request) => {
			hosts.add(new URL(request.url()).host)
		})
		await openFamily(page)
		const thumbnail = tile(page, 1).locator('img')
		await expect(thumbnail).toHaveAttribute('src', /\/api\/v1\/immich\/family\/assets\/[0-9a-f-]+\/image\?size=thumbnail&v=/)
		await expect(thumbnail).toHaveJSProperty('complete', true)

		const preview = page.waitForResponse((response) => response.url().includes('/image?size=preview'))
		const loupe = await openLoupe(page)
		const answer = await preview
		expect(answer.status()).toBe(200)
		expect(answer.headers()['cache-control']).toBe('private, max-age=31536000, immutable')
		await expect(loupe.getByRole('img', { name: uploadName(1) })).toHaveJSProperty('complete', true)
		expect([...hosts]).toEqual([new URL(page.url()).host])
	})

	// spec: IMMICH-002.9, IMMICH-002.10
	test('steps the loupe past the loaded page and shows the new neighbours on the filmstrip', async ({ page }) => {
		await openFamily(page)
		const loupe = await openLoupe(page)
		await expect(loupe).toContainText('1 / 3,660')

		const next = page.waitForResponse(LISTING)
		for (let n = 1; n < PAGE_SIZE - 10; n++) {
			await page.keyboard.press('ArrowRight')
		}
		await expect(loupe.getByRole('heading', { name: uploadName(PAGE_SIZE - 10) })).toBeVisible()
		expect((await next).status()).toBe(200)
		const filmstrip = loupe.getByRole('navigation', { name: 'Filmstrip' })
		for (let n = PAGE_SIZE - 10; n <= PAGE_SIZE; n++) {
			await page.keyboard.press('ArrowRight')
		}

		await expect(loupe.getByRole('heading', { name: uploadName(PAGE_SIZE + 1) })).toBeVisible()
		await expect(loupe).toContainText('101 / 3,660')
		await expect(filmstrip.getByRole('button', { name: uploadName(PAGE_SIZE + 2) })).toBeVisible()
	})

	// spec: IMMICH-002.15, IMMICH-003.1, IMMICH-003.13
	test('picks in the loupe, counts it at once and keeps it after a reload', async ({ page }) => {
		const main = await openFamily(page)
		const picked = main.getByRole('group', { name: 'Flag' }).getByRole('button', { name: 'Picked' })
		await expect(picked).toContainText('0')
		const loupe = await openLoupe(page)

		const saved = page.waitForResponse((response) => response.url().includes('/api/v1/immich/family/decisions'))
		await page.keyboard.press('p')
		expect((await saved).status()).toBe(200)
		await expect(page.getByRole('status').filter({ hasText: uploadName(1) })).toContainText(`Picked ${uploadName(1)}`)
		await expect(loupe.getByRole('heading', { name: uploadName(2) })).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(picked).toContainText('1')

		await page.reload()
		await page.getByRole('button', { name: 'Immich', exact: true }).click()
		await expect(picked).toContainText('1')
		await expect(main).toContainText('1 decided')
	})

	// spec: IMMICH-002.30, IMMICH-002.31, IMMICH-002.32
	test('chooses a time on the filter bar, starts over, keeps it after a reload and clears it', async ({ page }) => {
		const main = await openFamily(page)
		const all = main.getByRole('group', { name: 'Time' }).getByRole('button', { name: 'All phone uploads' })
		const clear = main.getByRole('button', { name: 'Clear filters' })
		await expect(all).toHaveAttribute('aria-pressed', 'false')
		await expect(clear).toBeHidden()

		const asked = page.waitForRequest((request) => request.method() === 'POST' && request.url().endsWith('/api/v1/immich/family/assets') && request.postDataJSON().filters.takenAfter === null)
		const saved = page.waitForResponse((response) => response.url().includes('/api/v1/view-state') && response.request().method() === 'PUT')
		await all.click()
		await asked
		expect((await saved).status()).toBe(200)
		await expect(all).toHaveAttribute('aria-pressed', 'true')

		await page.reload()
		await page.getByRole('button', { name: 'Immich', exact: true }).click()
		await expect(all).toHaveAttribute('aria-pressed', 'true')
		await clear.click()
		await expect(all).toHaveAttribute('aria-pressed', 'false')
		await expect(clear).toBeHidden()
	})

	// spec: IMMICH-003.19
	test('takes several decisions back with Ctrl+Z in reverse order, in the loupe and in the grid', async ({ page }) => {
		const saves: { assetId: string, rating: number, flag: string }[][] = []
		page.on('request', (request) => {
			if (request.url().endsWith('/api/v1/immich/family/decisions')) {
				saves.push((request.postDataJSON() as { decisions: { assetId: string, rating: number, flag: string }[] }).decisions)
			}
		})
		// Each step waits for its save, so the four go out apart and none is left when the page closes.
		const saved = async (step: () => Promise<void>) => {
			const answer = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
			await step()
			expect((await answer).status()).toBe(200)
		}
		await openFamily(page)
		const loupe = await openLoupe(page)
		const toast = page.getByRole('status').filter({ hasText: 'PXL_E2E_' })
		await saved(() => page.keyboard.press('2'))
		await expect(toast).toContainText(`Rated ${uploadName(1)} ★★`)
		await page.keyboard.press('ArrowRight')
		await saved(() => page.keyboard.press('x'))
		await expect(toast).toContainText(`Rejected ${uploadName(2)}`)
		await expect(loupe.getByRole('heading', { name: uploadName(3) })).toBeVisible()

		await saved(() => page.keyboard.press('Control+z'))
		await expect(toast).toContainText(`Undid: Rejected ${uploadName(2)}`)
		await page.keyboard.press('Escape')
		await expect(loupe).toBeHidden()
		await saved(() => page.keyboard.press('Control+z'))
		await expect(toast).toContainText(`Undid: Rated ${uploadName(1)} ★★`)

		expect(saves).toHaveLength(4)
		const [rated, rejected, unrejected, unrated] = saves.map((rows) => rows.map(({ rating, flag }) => ({ rating, flag })))
		expect(rated).toEqual([{ rating: 2, flag: expect.any(String) }])
		expect(rejected).toEqual([{ rating: 0, flag: 'rejected' }])
		expect(unrejected).toEqual([{ rating: 0, flag: 'unflagged' }])
		expect(unrated).toEqual([{ rating: 0, flag: rated![0]!.flag }])
		expect(saves[2]![0]!.assetId).toBe(saves[1]![0]!.assetId)
		expect(saves[3]![0]!.assetId).toBe(saves[0]![0]!.assetId)
	})

	// spec: IMMICH-002.28
	test('takes a rejected picture out of the grid once the loupe closes, and undo brings it back', async ({ page }) => {
		const main = await openFamily(page)
		const rejected = main.getByRole('group', { name: 'Flag' }).getByRole('button', { name: 'Rejected' })
		const before = Number((await rejected.textContent())!.replace(/\D/g, ''))
		const loupe = await openLoupe(page)
		const filmstrip = loupe.getByRole('navigation', { name: 'Filmstrip' })
		await page.keyboard.press('ArrowRight')
		await page.keyboard.press('ArrowRight')
		await expect(loupe.getByRole('heading', { name: uploadName(3) })).toBeVisible()
		const listings: string[] = []
		page.on('request', (request) => {
			if (request.url().endsWith('/api/v1/immich/family/assets')) {
				listings.push(request.url())
			}
		})
		const toast = page.getByRole('status').filter({ hasText: 'PXL_E2E_' })

		const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
		await page.keyboard.press('x')
		expect((await saved).status()).toBe(200)
		await expect(loupe.getByRole('heading', { name: uploadName(4) })).toBeVisible()
		await expect(filmstrip.getByRole('button', { name: uploadName(3) })).toBeVisible()
		await page.keyboard.press('Escape')
		await expect(loupe).toBeHidden()

		await expect(tile(page, 3)).toBeHidden()
		await expect(tile(page, 4)).toBeVisible()
		await expect(rejected).toContainText(String(before + 1))
		expect(listings).toEqual([])

		const undone = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
		await page.keyboard.press('Control+z')
		await expect(toast).toContainText(`Undid: Rejected ${uploadName(3)}`)
		await expect(tile(page, 3)).toBeVisible()
		expect((await undone).status()).toBe(200)

		const redone = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
		await page.keyboard.press('Control+Shift+z')
		await expect(tile(page, 3)).toBeHidden()
		expect((await redone).status()).toBe(200)
		await rejected.click()
		await expect(rejected).toHaveAttribute('aria-pressed', 'true')
		await expect(tile(page, 3)).toBeVisible()

		const cleared = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
		await page.keyboard.press('Control+z')
		await expect(toast).toContainText(`Undid: Rejected ${uploadName(3)}`)
		expect((await cleared).status()).toBe(200)
	})
})
