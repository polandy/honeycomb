// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createFolder, JPEG, RAW, requestToken, upload } from './files.ts'

/** A folder name no earlier run left behind. */
const uniqueFolder = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`

/** The folder picker the app opens on start. */
async function openPicker(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await expect(picker).toBeVisible()
	return picker
}

// spec: GRID-001.4, LISTING-003.12
test('culls a ticked folder in a grid of pairs and singles', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = uniqueFolder('Grid')
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	const picker = await openPicker(page)
	await picker.getByRole('option', { name: folder }).click()
	await expect(picker.getByText('2 photos in 1 folder')).toBeVisible()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()

	await expect(picker).toBeHidden()
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
})

// spec: GRID-001.9, LISTING-003.7, LISTING-003.12
test('culls a folder with its subfolders and groups the grid by folder', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = uniqueFolder('Trip')
	await createFolder(page, folder)
	await createFolder(page, `${folder}/Day 2`)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/Day 2/IMG_0002.jpg`, JPEG)

	const picker = await openPicker(page)
	await picker.getByRole('option', { name: folder }).click()
	await picker.getByText('Include subfolders', { exact: true }).click()
	await expect(picker.getByRole('switch', { name: 'Include subfolders' })).toBeChecked()
	await expect(picker.getByText('2 photos in 2 folders')).toBeVisible()
	await picker.getByRole('button', { name: 'Cull 2 folders' }).click()

	await expect(picker).toBeHidden()
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByText('Group by folder', { exact: true }).click()
	await expect(page.getByRole('checkbox', { name: 'Group by folder' })).toBeChecked()
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('rowheader', { name: folder })).toBeVisible()
	await expect(grid.getByRole('rowheader', { name: 'Day 2' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
})

// spec: GRID-002.1
test('hides a rejected photo in the default scope and shows it under All', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = uniqueFolder('Scope')
	await createFolder(page, folder)
	const rejected = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	const decision = { fileId: rejected, rating: 0, colourLabel: null, flag: 'rejected', keepRaw: false }
	const saved = await page.request.put('/index.php/apps/honeycomb/api/v1/decisions', {
		data: { decisions: [decision] },
		headers: { requesttoken: await requestToken(page) },
	})
	expect(saved.status()).toBe(204)

	const picker = await openPicker(page)
	await picker.getByRole('option', { name: folder }).click()
	await picker.getByRole('button', { name: `Cull ${folder}` }).click()

	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(page.getByText('1 / 2 decided')).toBeVisible()
	await page.getByRole('button', { name: 'All', exact: true }).click()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0001, JPG only' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
})

// spec: GRID-003.5
test('rates and rejects selected photos and keeps the decisions over a reload', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = uniqueFolder('Select')
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	const cull = async () => {
		const picker = await openPicker(page)
		await picker.getByRole('option', { name: folder }).click()
		await picker.getByRole('button', { name: `Cull ${folder}` }).click()
		await expect(picker).toBeHidden()
		return page.getByRole('grid', { name: 'Photos' })
	}

	const grid = await cull()
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' }).click()
	await grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
	await expect(page.getByText('2 selected')).toBeVisible()
	await page.getByRole('button', { name: 'Rate 3 stars' }).click()
	await page.getByRole('button', { name: 'Keep RAW', exact: true }).click()
	await grid.getByRole('gridcell', { name: /^IMG_0001/ }).click()
	await expect(page.getByText('1 selected')).toBeVisible()
	await page.getByRole('button', { name: 'Reject', exact: true }).click()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)

	await page.reload()
	const again = await cull()
	await expect(again.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF, 3 stars, Keep RAW' })).toBeVisible()
	await expect(again.getByRole('gridcell')).toHaveCount(1)
})
