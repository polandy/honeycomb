// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload } from './files.ts'

// spec: DECISIONS-002.8
test('lists a culled folder set under Recent and opens it at its position', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const id = randomUUID().slice(0, 8)
	const [first, second] = [`Recent ${id} A`, `Recent ${id} B`]
	for (const folder of [first, second]) {
		await createFolder(page, folder)
	}
	const fileIds: number[] = []
	for (const name of ['IMG_0001', 'IMG_0002']) {
		fileIds.push(await upload(page, `${first}/${name}.jpg`, JPEG))
	}
	await upload(page, `${second}/IMG_0003.jpg`, JPEG)

	await cullFolder(page, first)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/positions') && response.request().method() === 'PUT' && response.request().postDataJSON().fileId === fileIds[1] && response.ok())
	await page.keyboard.press('ArrowRight')
	await saved

	await cullFolder(page, second)
	const recent = page.getByRole('navigation', { name: 'honeycomb' }).getByRole('link', { name: first })
	await expect(recent).toContainText('0 / 2 decided')
	await recent.click()
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 2')).toBeVisible()
})
