// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

// spec: DECISIONS-002.7
test('saves where the loupe stands and offers to continue there after a fresh start', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Resume ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const fileIds: number[] = []
	for (const name of ['IMG_0001', 'IMG_0002', 'IMG_0003']) {
		fileIds.push(await upload(page, `${folder}/${name}.jpg`, JPEG))
	}

	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/positions') && response.request().method() === 'PUT' && response.request().postDataJSON().fileId === fileIds[1] && response.ok())
	await page.keyboard.press('ArrowRight')
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await saved

	await cullFolder(page, folder)
	const toast = page.getByRole('status').filter({ hasText: 'Continue where you left off' })
	await toast.getByRole('button', { name: 'Resume' }).click()
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 3')).toBeVisible()
})
