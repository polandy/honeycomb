// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, openFolderPicker, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload } from './files.ts'

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
	const recent = page.getByRole('navigation', { name: 'honeycomb navigation' }).getByRole('link', { name: first })
	await expect(recent).toContainText('0 / 2 decided')
	await recent.click()
	await expect(loupe.getByRole('heading', { name: 'IMG_0002' })).toBeVisible()
	await expect(loupe.getByText('2 of 2')).toBeVisible()
})

// spec: LISTING-003.15
test('lists at most three recent folder sets under the folder tree on a phone and opens the rest in place', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const id = randomUUID().slice(0, 8)
	const folders = [`Below ${id} A`, `Below ${id} B`, `Below ${id} C`, `Below ${id} D with a very long name that cannot fit on one line of a phone`]
	for (const folder of folders) {
		await createFolder(page, folder)
		const fileId = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
		const saved = await page.request.put('/index.php/apps/honeycomb/api/v1/positions', {
			data: { folderSet: { paths: [`/${folder}`], subfolders: false }, fileId, decided: 0, total: 1 },
			headers: await apiHeaders(page),
		})
		expect(saved.status()).toBe(200)
	}

	await page.goto('/index.php/apps/honeycomb/')
	const picker = await openFolderPicker(page)
	const rows = picker.locator('.picker-recent-sets__row')
	await expect(rows).toHaveCount(3)
	const tree = (await picker.getByRole('treeitem').first().boundingBox())!
	const first = (await rows.first().boundingBox())!
	expect(first.y).toBeGreaterThan(tree.y)
	expect(first.height).toBeGreaterThanOrEqual(44)
	expect(first.x + first.width).toBeLessThanOrEqual(390)

	await picker.getByRole('button', { name: /^Show all/ }).click()
	await expect(rows.nth(3)).toBeVisible()
	const longRow = picker.locator('.picker-recent-sets__row', { hasText: 'with a very long name' })
	await expect(longRow.locator('.picker-recent-sets__progress')).toBeVisible()
	const box = (await longRow.boundingBox())!
	expect(box.x + box.width).toBeLessThanOrEqual(390)
})
