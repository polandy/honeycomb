// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

/** Pixel 9 Pro in portrait. */
const PHONE = { width: 410, height: 914 }
/** iPad mini in portrait. */
const TABLET = { width: 744, height: 1133 }
/** Controls whose centres lie closer than this share a row. */
const ROW_TOLERANCE_PX = 12
const FIRST_ROW = ['Move…', 'Delete…']
const DECISIONS = [/^Colour label/, /^Keep RAW/, /^Tags$/]

test.use({ hasTouch: true })

/** The vertical centre of a control. */
async function centre(locator: Locator): Promise<number> {
	const box = await locator.boundingBox()
	if (box === null) {
		throw new Error('control is not visible')
	}
	return box.y + box.height / 2
}

/** Culls a new folder of one JPEG and enters selection mode; returns the action bar. */
async function selecting(page: Page): Promise<Locator> {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Selection bar ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await cullFolder(page, folder)
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	return page.locator('.action-bar')
}

/** The centre of the flags, after checking that Move and Delete share their row. */
async function firstRow(bar: Locator): Promise<number> {
	const flags = await centre(bar.getByRole('group', { name: 'Flag' }))
	for (const name of FIRST_ROW) {
		expect(Math.abs(await centre(bar.getByRole('button', { name, exact: true })) - flags), name).toBeLessThan(ROW_TOLERANCE_PX)
	}
	return flags
}

// spec: GRID-003.14
test('puts the flags, Move and Delete first and the decisions in a second row on a tablet', async ({ page }) => {
	await page.setViewportSize(TABLET)
	const bar = await selecting(page)

	const first = await firstRow(bar)
	const second = await centre(bar.getByRole('group', { name: 'Rating' }))
	expect(second).toBeGreaterThan(first + ROW_TOLERANCE_PX)
	for (const name of DECISIONS) {
		expect(Math.abs(await centre(bar.getByRole('button', { name })) - second), String(name)).toBeLessThan(ROW_TOLERANCE_PX)
	}
})

// spec: GRID-003.14
test('puts the flags, Move and Delete first on a phone, the decisions below them', async ({ page }) => {
	await page.setViewportSize(PHONE)
	const bar = await selecting(page)

	const first = await firstRow(bar)
	expect(await centre(bar.getByRole('group', { name: 'Rating' }))).toBeGreaterThan(first + ROW_TOLERANCE_PX)
	for (const name of DECISIONS) {
		expect(await centre(bar.getByRole('button', { name })), String(name)).toBeGreaterThan(first + ROW_TOLERANCE_PX)
	}
})
