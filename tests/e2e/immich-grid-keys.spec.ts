// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { resetViewState } from './cull.ts'
import { ALICE, openFamily, PAGE_SIZE, tile, uploadName } from './immich-grid.ts'
import { logIn, occ } from './server.ts'

type Row = { assetId: string, rating: number, flag: string }

/** Runs the step and returns the rows of the decision save it sends. */
async function saved(page: Page, step: () => Promise<void>): Promise<Row[]> {
	const answer = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
	await step()
	const response = await answer
	expect(response.status()).toBe(200)
	return (response.request().postDataJSON() as { decisions: Row[] }).decisions
}

test.describe('the keys and the selection of an Immich grid', () => {
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

	// spec: IMMICH-003.25
	test('rejects the focused tile by key, moves the focus on and opens the loupe on it', async ({ page }) => {
		await openFamily(page)
		await page.keyboard.press('ArrowRight')
		await expect(tile(page, 2)).toBeFocused()

		const rows = await saved(page, () => page.keyboard.press('x'))
		expect(rows.map(({ flag }) => flag)).toEqual(['rejected'])
		await expect(page.getByRole('status').filter({ hasText: 'PXL_E2E_' })).toContainText(`Rejected ${uploadName(2)}`)
		await expect(tile(page, 2)).toBeHidden()
		await expect(tile(page, 3)).toBeFocused()

		await page.keyboard.press('e')
		const loupe = page.getByRole('dialog', { name: 'Loupe' })
		await expect(loupe.getByRole('heading', { name: uploadName(3) })).toBeVisible()
		await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
		await page.keyboard.press('Escape')
		await expect(loupe).toBeHidden()
		const undone = await saved(page, () => page.keyboard.press('Control+z'))
		expect(undone).toEqual([{ ...rows[0]!, flag: 'unflagged' }])
		await expect(tile(page, 2)).toBeVisible()
	})

	// spec: IMMICH-003.26, IMMICH-003.27, IMMICH-003.28
	test('selects the loaded uploads, rates a selection in one save and one undo step, and leaves on Esc', async ({ page }) => {
		const main = await openFamily(page)
		await page.keyboard.press('Control+a')
		await expect(main).toContainText(`${PAGE_SIZE} selected`)
		await expect(tile(page, 1)).toHaveAttribute('aria-selected', 'true')
		await page.keyboard.press('Control+d')
		await expect(main).toContainText('0 selected')
		await expect(tile(page, 1)).toHaveAttribute('aria-selected', 'false')

		for (const n of [1, 2, 3]) {
			await tile(page, n).click()
		}
		await expect(main).toContainText('3 selected')
		const bar = page.locator('.action-bar')
		await expect(bar.getByRole('group', { name: 'Rating' })).toBeVisible()
		await expect(bar.getByRole('button', { name: /^Keep RAW/ })).toHaveCount(0)
		await expect(bar.getByRole('button', { name: 'Tags' })).toHaveCount(0)

		const rated = await saved(page, () => page.keyboard.press('2'))
		expect(rated.map(({ rating }) => rating)).toEqual([2, 2, 2])
		const undone = await saved(page, () => page.keyboard.press('Control+z'))
		expect(undone.map(({ rating }) => rating)).toEqual([0, 0, 0])
		expect(new Set(undone.map(({ assetId }) => assetId))).toEqual(new Set(rated.map(({ assetId }) => assetId)))

		await page.keyboard.press('Escape')
		await expect(bar).toBeHidden()
		await expect(tile(page, 1)).not.toHaveAttribute('aria-selected')
		await tile(page, 1).click()
		await expect(page.getByRole('dialog', { name: 'Loupe' }).getByRole('heading', { name: uploadName(1) })).toBeVisible()
	})
})
