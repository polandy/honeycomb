// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect } from '@playwright/test'

/** The user the e2e connections file gives two connections to the stub Immich (`tests/fixtures/immich/e2e/`). */
export const ALICE = { username: 'alice', password: 'honeycomb-e2e-alice-password' }
/** The listing route of the connection whose key the stub takes; its library holds 3,660 uploads, `PXL_E2E_0001` the newest. */
export const LISTING = '**/api/v1/immich/family/assets'
/** The listing's page size, so the 101st upload is the second page's first. */
export const PAGE_SIZE = 100

/** Opens honeycomb as Alice on the Immich source, Family phones first, and waits for its first page. */
export async function openFamily(page: Page): Promise<Locator> {
	await page.goto('/index.php/apps/honeycomb/')
	await page.getByRole('button', { name: 'Immich', exact: true }).click()
	const main = page.getByRole('main')
	await expect(main).toContainText('3,660 of 3,660 photos')
	await expect(tile(page, 1)).toBeVisible()
	return main
}

/** The grid's tile of the n-th newest upload. */
export function tile(page: Page, n: number): Locator {
	return page.getByRole('gridcell', { name: new RegExp(`^${uploadName(n)},`) })
}

/** The file name of the n-th newest upload. */
export function uploadName(n: number): string {
	return `PXL_E2E_${String(n).padStart(4, '0')}`
}

/** Opens the newest upload in the loupe and dismisses the guide. */
export async function openLoupe(page: Page): Promise<Locator> {
	await tile(page, 1).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await expect(loupe.getByRole('heading', { name: uploadName(1) })).toBeVisible()
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	return loupe
}
