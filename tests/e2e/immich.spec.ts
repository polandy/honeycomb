// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { apiHeaders } from './files.ts'
import { logIn, occ } from './server.ts'

const API = '/index.php/apps/honeycomb/api/v1/immich'
/** The user the e2e connections file gives two connections to the stub Immich (`tests/fixtures/immich/e2e/`). */
const ALICE = { username: 'alice', password: 'honeycomb-e2e-alice-password' }
const FAMILY = { id: 'family', label: 'Family phones', url: 'http://127.0.0.1:2283' }
const ANNA = { id: 'anna', label: 'Anna\'s phone', url: 'http://127.0.0.1:2283' }

/** Opens honeycomb as Alice and switches to the Immich source. */
async function openImmich(page: Page): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	await page.getByRole('button', { name: 'Immich', exact: true }).click()
}

/** The connection switcher's entry for the connection. */
function connectionEntry(page: Page, label: string) {
	return page.getByRole('navigation').locator('.list-item__wrapper').filter({ hasText: label })
}

test.describe('as a user with two Immich connections', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test.beforeAll(() => {
		occ(['user:add', '--password-from-env', ALICE.username], { OC_PASS: ALICE.password })
	})

	test.afterAll(() => {
		occ(['user:delete', ALICE.username])
	})

	test.beforeEach(async ({ page }) => {
		await logIn(page, ALICE)
	})

	// spec: IMMICH-001.2
	test('lists their own connections in file order, without keys', async ({ page }) => {
		const response = await page.request.get(`${API}/connections`, { headers: await apiHeaders(page) })

		expect(response.status()).toBe(200)
		expect(await response.json()).toEqual({ connections: [FAMILY, ANNA] })
	})

	// spec: IMMICH-001.20
	// spec: IMMICH-001.14
	test('opens Immich without a folder and lists both connections with their status', async ({ page }) => {
		await openImmich(page)

		await expect(connectionEntry(page, FAMILY.label)).toContainText('Connected as Alice')
		await expect(connectionEntry(page, ANNA.label)).toContainText('The API key is refused')
		await expect(page.getByRole('main')).toContainText('3,660 of 3,660 pictures')
	})

	// spec: IMMICH-001.8
	// spec: IMMICH-001.19
	test('shows a refused connection with Try again, which asks its status again', async ({ page }) => {
		await openImmich(page)
		await connectionEntry(page, ANNA.label).click()

		const main = page.getByRole('main')
		await expect(main).toContainText('The API key is refused')
		await expect(main).toContainText('Decisions already made stay in honeycomb.')
		const asked = page.waitForResponse(`**/api/v1/immich/${ANNA.id}/status`)
		await main.getByRole('button', { name: 'Try again' }).click()
		expect((await (await asked).json()).state).toBe('refused')
	})

	// spec: IMMICH-001.14
	test('opens the connection opened last again after a reload', async ({ page }) => {
		await openImmich(page)
		await connectionEntry(page, ANNA.label).click()
		await expect(page.getByRole('main')).toContainText('The API key is refused')

		await page.reload()
		await page.getByRole('button', { name: 'Immich', exact: true }).click()

		await expect(page.getByRole('main')).toContainText('The API key is refused')
	})

	// spec: IMMICH-001.13
	test('shows the connection read only in its dialog, and Test connection asks the status again', async ({ page }) => {
		await openImmich(page)
		await expect(connectionEntry(page, FAMILY.label)).toContainText('Connected as Alice')
		await page.getByRole('navigation').getByRole('link', { name: 'Connection details' }).click()

		const dialog = page.getByRole('dialog', { name: 'Immich connection' })
		for (const fact of [FAMILY.label, FAMILY.url, 'Connected as Alice', 'Alice', '3.4.2', 'asset.read', 'asset.view', 'asset.statistics', 'user.read']) {
			await expect(dialog).toContainText(fact)
		}
		await expect(dialog.getByRole('textbox')).toHaveCount(0)
		const asked = page.waitForResponse(`**/api/v1/immich/${FAMILY.id}/status`)
		await dialog.getByRole('button', { name: 'Test connection' }).click()
		expect((await (await asked).json()).state).toBe('ok')
		await dialog.getByRole('button', { name: 'Done' }).click()
		await expect(dialog).toBeHidden()
	})

	// spec: IMMICH-001.15
	test('keeps the Nextcloud source usable beside a refused connection', async ({ page }) => {
		await openImmich(page)
		await connectionEntry(page, ANNA.label).click()
		await expect(page.getByRole('main')).toContainText('The API key is refused')

		await page.getByRole('button', { name: 'Nextcloud', exact: true }).click()

		await expect(page.getByRole('heading', { name: 'Where is your library?' })).toBeVisible()
	})
})

test('a user without a connection sees no Immich source', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	await expect(page.getByRole('heading', { name: 'Where is your library?' })).toBeVisible()
	const response = await page.request.get(`${API}/connections`, { headers: await apiHeaders(page) })
	expect(await response.json()).toEqual({ connections: [] })
	await expect(page.getByRole('button', { name: 'Immich', exact: true })).toHaveCount(0)
})
