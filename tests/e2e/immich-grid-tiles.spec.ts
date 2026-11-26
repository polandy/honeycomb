// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { resetViewState } from './cull.ts'
import { ALICE, LISTING, openFamily, PAGE_SIZE, tile } from './immich-grid.ts'
import { logIn, occ } from './server.ts'

/** The pill's box lies in the top left quarter of its tile's box. */
async function inTopLeft(pill: Locator, tileBox: Locator): Promise<boolean> {
	const [inner, outer] = [(await pill.boundingBox())!, (await tileBox.boundingBox())!]
	return inner.width > 0 && inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.width <= outer.x + outer.width / 2 && inner.y + inner.height <= outer.y + outer.height / 2
}

test.describe('the tiles and the failed page of an Immich grid', () => {
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

	// spec: IMMICH-002.37
	test('shows LIVE, a video\'s duration and a stack\'s size at the top left of the tile, and no pair badge', async ({ page }, testInfo) => {
		const main = await openFamily(page)

		await expect(tile(page, 1).locator('.photo-tile__pill')).toHaveCount(0)
		for (const [n, text, label] of [[2, 'LIVE', 'Motion photo'], [3, '0:12', 'Video, 0:12'], [4, '3', 'Photo, Stack of 3 photos']] as const) {
			const pill = tile(page, n).locator('.photo-tile__pill')
			await expect(pill).toHaveText(text)
			await expect(pill.locator('svg')).toBeVisible()
			expect(await inTopLeft(pill, tile(page, n).locator('.photo-tile__photo'))).toBe(true)
			await expect(tile(page, n)).toHaveAttribute('aria-label', new RegExp(`^PXL_E2E_000${n}, ${label}`))
		}
		await expect(main.locator('.photo-tile__pair')).toHaveCount(0)
		expect(await tile(page, 2).locator('img').evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
		await tile(page, 4).locator('img').evaluate((image: HTMLImageElement) => image.decode())
		await main.getByRole('grid').screenshot({ path: testInfo.outputPath('immich-tile-pills.png') })
	})

	// spec: IMMICH-002.19
	test('keeps two loaded pages when the third fails, names the state and asks the same cursor on Try again', async ({ page }, testInfo) => {
		const cursors: (string | null)[] = []
		await page.route(LISTING, async (route) => {
			cursors.push((route.request().postDataJSON() as { cursor: string | null }).cursor)
			await (cursors.length === 3 ? route.fulfill({ status: 502, json: { error: 'unreachable' } }) : route.continue())
		})
		const main = await openFamily(page)
		const grid = main.getByRole('grid')
		await grid.hover()
		await page.mouse.wheel(0, 1_000_000)
		await expect(tile(page, PAGE_SIZE + 1)).toBeAttached()
		await page.mouse.wheel(0, 1_000_000)

		const footer = main.getByText('Immich unreachable. The photos above stay.')
		await expect(footer).toBeVisible()
		await expect(tile(page, 2 * PAGE_SIZE)).toBeVisible()
		await expect(main).not.toContainText('Could not load more photos.')
		expect(cursors).toHaveLength(3)
		await page.screenshot({ path: testInfo.outputPath('immich-page-failed.png') })

		await main.getByRole('button', { name: 'Try again' }).click()
		await expect(footer).toBeHidden()
		await page.mouse.wheel(0, 1_000_000)
		await expect(tile(page, 2 * PAGE_SIZE + 1)).toBeVisible()
		expect(cursors[3]).toBe(cursors[2])
		expect(cursors[2]).not.toBeNull()
	})
})
