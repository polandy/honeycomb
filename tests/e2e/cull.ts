// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

/** Opens the app and culls `folder` from the folder picker. */
export async function cullFolder(page: Page, folder: string): Promise<void> {
	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await picker.getByRole('option', { name: folder }).click()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()
}
