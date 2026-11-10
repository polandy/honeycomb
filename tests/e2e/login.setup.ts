// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test as setup } from '@playwright/test'
import { ADMIN, ADMIN_STATE } from './admin.ts'

setup('logs in as the admin', async ({ page }) => {
	await page.goto('/index.php/login')
	await page.getByLabel('Account name or email').fill(ADMIN.username)
	await page.getByLabel('Password', { exact: true }).fill(ADMIN.password)
	await page.getByRole('button', { name: 'Log in', exact: true }).click()
	await page.waitForURL(/\/apps\//)

	await page.context().storageState({ path: ADMIN_STATE })
})
