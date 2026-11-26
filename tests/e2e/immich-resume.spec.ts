// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { resetViewState } from './cull.ts'
import { logIn, occ } from './server.ts'

/** The user the e2e connections file gives two connections to the stub Immich (`tests/fixtures/immich/e2e/`). */
const ALICE = { username: 'alice', password: 'honeycomb-e2e-alice-password' }
/** A day after the stub library's newest upload, so the default month holds all of it. */
const TODAY = new Date(Date.UTC(2026, 10, 20, 12))

function uploadName(n: number): string {
	return `PXL_E2E_${String(n).padStart(4, '0')}`
}

/** Whether the request saves a position of the connection Family phones. */
function savesFamilyPosition(request: { url: () => string, method: () => string, postDataJSON: () => unknown }): boolean {
	return request.method() === 'PUT' && request.url().endsWith('/api/v1/positions') && (request.postDataJSON() as { immich?: string }).immich === 'family'
}

/** Shows the Immich source, Family phones first, and waits for its newest upload. */
async function showImmich(page: Page) {
	await page.getByRole('button', { name: 'Immich', exact: true }).click()
	await expect(page.getByRole('gridcell', { name: new RegExp(`^${uploadName(1)},`) })).toBeVisible()
}

test.describe('resuming an Immich connection', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test.beforeAll(() => {
		occ(['user:add', '--password-from-env', ALICE.username], { OC_PASS: ALICE.password })
	})

	test.afterAll(() => {
		occ(['user:delete', ALICE.username])
	})

	test.beforeEach(async ({ page }) => {
		await page.clock.setFixedTime(TODAY)
		await logIn(page, ALICE)
		await page.goto('/index.php/apps/honeycomb/')
		await resetViewState(page)
	})

	// spec: IMMICH-003.14, IMMICH-003.15, IMMICH-002.34
	test('saves the loupe\'s upload, offers it after a reload, opens there on Resume and loads the newer uploads back', async ({ page }) => {
		await page.goto('/index.php/apps/honeycomb/')
		await showImmich(page)
		await page.getByRole('gridcell', { name: new RegExp(`^${uploadName(1)},`) }).click()
		const loupe = page.getByRole('dialog', { name: 'Loupe' })
		await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
		const saved = page.waitForRequest((request) => savesFamilyPosition(request) && (request.postDataJSON() as { assetId: string }).assetId.endsWith('000000000001'))
		await page.keyboard.press('ArrowRight')
		await expect(loupe.getByRole('heading', { name: uploadName(2) })).toBeVisible()
		expect((await (await saved).response())!.status()).toBe(200)

		await page.reload()
		await showImmich(page)
		const offer = page.getByRole('status').filter({ hasText: 'Continue where you left off' })
		const fromAsset = page.waitForRequest((request) => request.url().endsWith('/api/v1/immich/family/assets') && (request.postDataJSON() as { from?: { assetId: string } }).from?.assetId.endsWith('000000000001') === true)
		await offer.getByRole('button', { name: 'Resume' }).click()
		await fromAsset

		await expect(loupe.getByRole('heading', { name: uploadName(2) })).toBeVisible()
		await expect(loupe).toContainText('2 / 3,660')
		await page.keyboard.press('ArrowLeft')
		await expect(loupe.getByRole('heading', { name: uploadName(1) })).toBeVisible()
		await expect(loupe).toContainText('1 / 3,660')

		await page.keyboard.press('Escape')
		await page.getByRole('button', { name: 'Nextcloud', exact: true }).click()
		const recent = page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: 'Family phones' })
		await expect(recent).toContainText(/Immich · \d+ \/ 3,660 decided/)
		await recent.click()
		await expect(page.getByRole('gridcell', { name: new RegExp(`^${uploadName(1)},`) })).toBeVisible()
		await expect(page.getByRole('status').filter({ hasText: 'Continue where you left off' })).toBeVisible()
	})
})
