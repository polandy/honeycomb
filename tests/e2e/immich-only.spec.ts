// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { openFolderPicker } from './cull.ts'
import { logIn, occ } from './server.ts'

/** The user the e2e connections file gives two connections to the stub Immich (`tests/fixtures/immich/e2e/`). */
const ALICE = { username: 'alice', password: 'honeycomb-e2e-alice-password' }
/** The connection whose key the stub refuses with Immich's 401. */
const ANNA_LABEL = 'Anna\'s phone'
/** What the Immich source shows once Family phones, whose key the stub takes, lists its uploads. */
const FAMILY_SHOWN = '3,660 of 3,660 photos'

test.describe('as a user who only uses Immich', () => {
	test.use({ storageState: { cookies: [], origins: [] } })

	test.beforeAll(() => {
		occ(['user:add', '--password-from-env', ALICE.username], { OC_PASS: ALICE.password })
	})

	test.afterAll(() => {
		occ(['user:delete', ALICE.username])
	})

	// spec: IMMICH-001.22
	// spec: IMMICH-001.23
	// spec: IMMICH-001.24
	test('opens Immich without the start screen once chosen, and Nextcloud again when the connection fails', async ({ page }) => {
		await logIn(page, ALICE)
		await page.goto('/index.php/apps/honeycomb/')
		const picker = await openFolderPicker(page)
		const main = page.getByRole('main')
		const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/settings') && response.request().method() === 'PUT')
		await picker.getByRole('button', { name: 'I only use Immich' }).click()
		await expect(main).toContainText(FAMILY_SHOWN)
		expect((await (await saved).json()).settings.immichOnly).toBe(true)

		await page.reload()
		await expect(main).toContainText(FAMILY_SHOWN)
		await expect(picker).toBeHidden()
		await expect(page.locator('.folders-home')).toBeHidden()

		await page.getByRole('navigation').locator('.list-item__wrapper').filter({ hasText: ANNA_LABEL }).click()
		await expect(main).toContainText('The API key is refused')
		await page.reload()
		await openFolderPicker(page)
		await expect(picker.getByRole('button', { name: 'I only use Immich' })).toBeDisabled()
		await expect(picker).toContainText('Immich refuses the API key.')
	})
})
