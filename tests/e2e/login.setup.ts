// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { test as setup } from '@playwright/test'
import { ADMIN, ADMIN_STATE } from './admin.ts'
import { logIn } from './server.ts'

setup('logs in as the admin', async ({ page }) => {
	await logIn(page, ADMIN)

	await page.context().storageState({ path: ADMIN_STATE })
})
