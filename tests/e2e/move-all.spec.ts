// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, E2E_SETTINGS, putSettings } from './cull.ts'
import { apiHeaders, createFolder, exists, JPEG, RAW, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

// spec: MOVE-005.1, MOVE-005.2, MOVE-005.9
test('moves every picture of the folder by Move all, the hidden rejects too, and leaves the folder and its other files', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const id = randomUUID().slice(0, 8)
	const folder = `Move all ${id}`
	const target = `Move all out ${id}`
	await createFolder(page, folder)
	await createFolder(page, target)
	await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	await upload(page, `${folder}/IMG_0001.NEF`, RAW)
	await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	const rejected = await upload(page, `${folder}/IMG_0003.jpg`, JPEG)
	await upload(page, `${folder}/notes.txt`, Buffer.from('shoot notes'))
	const flagged = await page.request.put(`${API}/flags`, { data: { flags: [{ fileId: rejected, flag: 'rejected', keepRaw: false }] }, headers: await apiHeaders(page) })
	expect(flagged.status(), await flagged.text()).toBe(200)

	await putSettings(page, { moveTemplate: '{name}.{ext}' })
	try {
		await cullFolder(page, folder)
		const grid = page.getByRole('grid', { name: 'Photos' })
		await expect(grid.getByRole('gridcell')).toHaveCount(2)
		await page.getByRole('button', { name: 'More' }).click()
		const moveAll = page.getByRole('button', { name: /^Move all…/ })
		await expect(moveAll).toHaveText(/Move all…\s*3$/)
		await expect(moveAll).toBeEnabled()
		await moveAll.click()

		const dialog = page.getByRole('dialog', { name: 'Move 3 photos' })
		await expect(dialog).toBeVisible()
		await dialog.getByRole('button', { name: 'Browse…' }).click()
		const browse = page.getByRole('dialog', { name: 'Choose the target folder' })
		await browse.getByRole('treeitem', { name: target }).click()
		await browse.getByRole('button', { name: 'Choose' }).click()
		await dialog.getByRole('button', { name: 'Move 4 files' }).click()
		await expect(dialog).toBeHidden()
		await expect(grid).toBeHidden()

		for (const name of ['IMG_0001.jpg', 'IMG_0001.NEF', 'IMG_0002.jpg', 'IMG_0003.jpg']) {
			expect(await exists(page, `${target}/${name}`), name).toBe(true)
			expect(await exists(page, `${folder}/${name}`), name).toBe(false)
		}
		expect(await exists(page, folder)).toBe(true)
		expect(await exists(page, `${folder}/notes.txt`)).toBe(true)

		await page.getByRole('button', { name: 'More' }).click()
		await expect(moveAll).toHaveText(/Move all…\s*0$/)
		await expect(moveAll).toBeDisabled()
	} finally {
		await putSettings(page, E2E_SETTINGS)
	}
})
