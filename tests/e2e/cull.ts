// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect } from '@playwright/test'
import { requestToken } from './files.ts'

/** Opens the app and culls `folder` from the folder picker. */
export async function cullFolder(page: Page, folder: string): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await picker.getByRole('option', { name: folder }).click()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()
}

/** Closes the info panel and brings the gesture guide back; the view state is the admin's, shared by every test (LOUPE-003). */
export async function resetViewState(page: Page): Promise<void> {
	const reset = await page.request.put('/index.php/apps/honeycomb/api/v1/view-state', {
		data: { viewState: { infoPanelOpen: false, gestureGuideSeen: false } },
		headers: { requesttoken: await requestToken(page) },
	})
	expect(reset.status(), await reset.text()).toBe(200)
}
