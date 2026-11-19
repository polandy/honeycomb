// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'
import { expectTouchTargets } from './touch-targets.ts'

const PHONE = { width: 390, height: 844 }

/** Culls a new folder of two photos, picks both from the selection and returns the card that opens. */
async function finishCull(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Finished ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	for (const name of ['IMG_0001, JPG only', 'IMG_0002, JPG only']) {
		await grid.getByRole('gridcell', { name }).click()
	}
	await page.getByRole('button', { name: 'Pick', exact: true }).click()
	const card = page.getByRole('dialog', { name: 'Cull finished' })
	// The dialog fades in; a screenshot before the end of the fade shows the grid alone.
	await expect(card).toHaveCSS('opacity', '1')
	return card
}

test.describe('on a phone', () => {
	test.use({ hasTouch: true })

	// spec: STATS-001.19
	test('opens Cull finished as a bottom sheet with 44 px buttons once the last photo is decided', async ({ page }, testInfo) => {
		await page.setViewportSize(PHONE)
		const card = await finishCull(page)

		await expect(card).toBeVisible()
		await expect(card).toContainText('2 photos decided')
		await expect(card).toContainText('Before 2 photos')
		const box = (await card.boundingBox())!
		expect(box.y + box.height).toBe(PHONE.height)
		await expectTouchTargets(card, 'Cull finished on a phone')
		await page.screenshot({ path: testInfo.outputPath('cull-finished-phone.png'), animations: 'disabled' })

		await card.getByRole('button', { name: 'Done' }).click()
		await expect(card).toBeHidden()
	})
})

// spec: STATS-001.19
test('opens Cull finished as a dialog on the desktop', async ({ page }, testInfo) => {
	const card = await finishCull(page)

	await expect(card).toBeVisible()
	await expect(card).toContainText('2 photos decided')
	await page.screenshot({ path: testInfo.outputPath('cull-finished-desktop.png'), animations: 'disabled' })
	await card.getByRole('button', { name: 'Done' }).click()
	await expect(card).toBeHidden()
})
