// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Locator } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { createFolder, exists, JPEG, RAW, upload } from './files.ts'

/** Whether two rendered boxes share any area. */
async function overlap(a: Locator, b: Locator): Promise<boolean> {
	const [one, two] = [await a.boundingBox(), await b.boundingBox()]
	if (one === null || two === null) {
		throw new Error('a box is not rendered')
	}
	return one.x < two.x + two.width && two.x < one.x + one.width && one.y < two.y + two.height && two.y < one.y + one.height
}

// spec: MOVE-005.4, MOVE-005.5, MOVE-005.6, MOVE-005.7, MOVE-005.8
test('names the moved files with the job code typed in the move dialog and offers it at the next move', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	const folder = `Job ${id}`
	const target = `Job out ${id}`
	await createFolder(page, folder)
	await createFolder(page, target)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await putSettings(page, { moveTemplate: '{job}_{number}.{ext}', moveJobCodes: ['Old shoot'] })
	try {
		await cullFolder(page, folder)
		const grid = page.getByRole('grid', { name: 'Photos' })
		await page.getByRole('button', { name: 'Select', exact: true }).click()
		await grid.getByRole('gridcell', { name: 'IMG_0001, JPG+NEF' }).click()
		await page.getByRole('button', { name: 'Move…', exact: true }).click()

		const dialog = page.getByRole('dialog', { name: 'Move 1 photo' })
		const field = dialog.getByRole('textbox', { name: 'Job code' })
		await expect(field).toBeVisible()
		await expect(field).toHaveValue('Old shoot')
		const recent = dialog.getByRole('group', { name: 'Recent job codes' }).getByRole('button')
		await expect(recent).toHaveText(['Old shoot'])
		await dialog.getByRole('button', { name: 'Browse…' }).click()
		const browse = page.getByRole('dialog', { name: 'Choose the target folder' })
		await browse.getByRole('treeitem', { name: target }).click()
		await browse.getByRole('button', { name: 'Choose' }).click()
		await expect(dialog.getByText(`→ /${target}/Old-shoot_0001.jpg`, { exact: true })).toBeVisible()

		await field.fill('')
		await expect(dialog.getByText('Enter a job code', { exact: true })).toBeVisible()
		await expect(dialog.getByRole('button', { name: 'Move 2 files' })).toBeDisabled()
		await field.pressSequentially(`Hochzeit Müller ${'x'.repeat(30)}`)
		await expect(field).toHaveValue(`Hochzeit Müller ${'x'.repeat(24)}`)
		await field.fill('Hochzeit Müller')
		await expect(dialog.getByText('Enter a job code', { exact: true })).toBeHidden()
		await expect(dialog.getByText(`→ /${target}/Hochzeit-Mueller_0001.NEF`, { exact: true })).toBeVisible()
		expect(await overlap(field, dialog.getByRole('region', { name: 'To' }))).toBe(false)
		await dialog.getByRole('button', { name: 'Move 2 files' }).click()
		await expect(page.getByRole('status').filter({ hasText: `Moved IMG_0001 to ${target}` })).toBeVisible()
		expect(await exists(page, `${target}/Hochzeit-Mueller_0001.jpg`)).toBe(true)
		expect(await exists(page, `${target}/Hochzeit-Mueller_0001.NEF`)).toBe(true)

		await grid.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
		await page.getByRole('button', { name: 'Move…', exact: true }).click()
		const next = page.getByRole('dialog', { name: 'Move 1 photo' })
		await expect(next.getByRole('textbox', { name: 'Job code' })).toHaveValue('Hochzeit Müller')
		await expect(next.getByRole('group', { name: 'Recent job codes' }).getByRole('button')).toHaveText(['Hochzeit Müller', 'Old shoot'])
	} finally {
		await putSettings(page, E2E_SETTINGS)
	}
})

// spec: MOVE-005.4
test('previews the job code as Job in the settings', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Job preview ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await putSettings(page, { moveTemplate: '{job:upper}/{job}_{name}.{ext}' })
	try {
		await cullFolder(page, folder)
		await page.getByRole('button', { name: 'More' }).click()
		await page.getByRole('button', { name: 'Settings', exact: true }).click()
		const dialog = page.getByRole('dialog', { name: 'Settings' })
		const preview = dialog.getByRole('list', { name: 'Preview with five sample photos' })
		await expect(preview.getByText('JOB/Job_DSCF1234.JPG').first()).toBeVisible()
		await expect(dialog.getByText(/^Tokens: .*\{job\}/)).toBeVisible()
	} finally {
		await putSettings(page, E2E_SETTINGS)
	}
})
