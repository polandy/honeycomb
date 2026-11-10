// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createFolder, JPEG, RAW, upload } from './files.ts'

/** A folder name no earlier run left behind. */
const uniqueFolder = (prefix: string) => `${prefix} ${randomUUID().slice(0, 8)}`

/** The folder picker the app opens on start. */
async function openPicker(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	const picker = page.getByRole('dialog', { name: 'Choose folders' })
	await expect(picker).toBeVisible()
	return picker
}

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
