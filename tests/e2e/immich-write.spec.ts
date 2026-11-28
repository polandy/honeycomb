// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { resetViewState } from './cull.ts'
import { ALICE, openFamily, tile } from './immich-grid.ts'
import { logIn, occ } from './server.ts'

/** Presses the key on the focused tile and waits for the decision save it sends. */
async function decide(page: Page, key: string): Promise<void> {
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/immich/family/decisions'))
	await page.keyboard.press(key)
	expect((await saved).status()).toBe(200)
}

/** Whether the two elements' boxes overlap. */
async function overlap(first: Locator, second: Locator): Promise<boolean> {
	const [a, b] = [await first.boundingBox(), await second.boundingBox()]
	return a === null || b === null || (a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height)
}

test.describe('Write to Immich', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	// A new Alice per test starts with no decision and nothing written.
	test.beforeEach(async ({ page }) => {
		occ(['user:add', '--password-from-env', ALICE.username], { OC_PASS: ALICE.password })
		await logIn(page, ALICE)
		await page.goto('/index.php/apps/honeycomb/')
		await resetViewState(page)
	})

	test.afterEach(() => {
		occ(['user:delete', ALICE.username])
	})

	// spec: IMMICH-004.25, IMMICH-004.26
	test('checks, plans and writes the decisions, then offers nothing more to write', async ({ page }) => {
		await openFamily(page)
		await page.keyboard.press('ArrowRight')
		await expect(tile(page, 2)).toBeFocused()
		await decide(page, 'x')
		await decide(page, 'x')
		await expect(tile(page, 4)).toBeFocused()
		await decide(page, 'x')
		await expect(tile(page, 5)).toBeFocused()
		await decide(page, 'p')
		await expect(tile(page, 6)).toBeFocused()
		await decide(page, '3')

		await page.getByRole('button', { name: 'Write to Immich' }).click()
		const dialog = page.getByRole('dialog', { name: 'Write to Immich' })
		for (const shown of ['5 photos change.', '3 rejected', '1 picked', 'They become favourites in Immich.', '1 rating', '1 to check before writing', 'Top of a stack of 3.']) {
			await expect(dialog).toContainText(shown)
		}
		const thumbnail = dialog.locator('.immich-write-plan__thumbnail')
		await expect(thumbnail).toHaveJSProperty('complete', true)
		expect(await thumbnail.evaluate((image: HTMLImageElement) => image.naturalWidth)).toBeGreaterThan(0)
		const cancel = dialog.getByRole('button', { name: 'Cancel' })
		const write = dialog.getByRole('button', { name: 'Write 5 changes' })
		expect(await overlap(cancel, write)).toBe(false)
		expect(await overlap(dialog.getByRole('radio', { name: 'Move to Immich trash' }), dialog.getByRole('radio', { name: 'Archive' }))).toBe(false)

		await write.click()
		await expect(dialog).toContainText('Written: 5')
		await expect(dialog).not.toContainText('Failed')
		await dialog.getByRole('button', { name: 'Done' }).click()
		await expect(dialog).toBeHidden()

		await page.getByRole('button', { name: 'Write to Immich' }).click()
		await expect(dialog).toContainText('0 photos change.')
		await expect(dialog.getByRole('button', { name: 'Write 0 changes' })).toBeDisabled()
	})
})
