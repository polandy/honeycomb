// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder } from './cull.ts'
import { createFolder, JPEG, RAW, upload } from './files.ts'

// spec: MOVE-004.1, MOVE-004.3, MOVE-004.9, MOVE-004.11
test('moves the selection to a folder chosen by Browse… and brings it back by Undo', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	const folder = `Move ${id}`
	const target = `Out ${id}`
	await createFolder(page, folder)
	await createFolder(page, target)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'Select', exact: true }).click()
	await grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' }).click()
	await page.getByRole('button', { name: 'Move…', exact: true }).click()

	const dialog = page.getByRole('dialog', { name: 'Move 1 photo' })
	await dialog.getByRole('button', { name: 'Browse…' }).click()
	const browse = page.getByRole('dialog', { name: 'Choose the target folder' })
	await browse.getByRole('option', { name: target }).click()
	await browse.getByRole('button', { name: 'Choose' }).click()
	await expect(dialog.getByText(`Moving to /${target}`)).toBeVisible()
	await dialog.getByRole('button', { name: 'Move 2 files' }).click()

	await expect(dialog).toBeHidden()
	const toast = page.getByRole('status').filter({ hasText: `Moved IMG_0001 to ${target}` })
	await expect(toast).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(1)
	await expect(grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' })).toBeVisible()

	await toast.getByRole('button', { name: 'Undo' }).click()
	await expect(page.getByRole('status').filter({ hasText: 'Moved 2 files back' })).toBeVisible()
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await expect(grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' })).toBeVisible()
})
