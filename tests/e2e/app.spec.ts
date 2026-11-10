// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'

test('opens on the empty state while no folder is chosen', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')

	const emptyState = page.getByRole('note', { name: 'No folder chosen' })
	await expect(emptyState).toBeVisible()
	await expect(emptyState.getByText('Pick a folder to start culling.')).toBeVisible()
})
