// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, upload, withCaptureTime } from './files.ts'

// spec: LOUPE-001.25, SERIES-001.24
test('opens the compare on the loupe\'s series by the chip, above the loupe, and lands after the series on pick-rest', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Series loupe ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:00:02'], ['IMG_0004', '10:05:00']]) {
		await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()

	await loupe.getByRole('button', { name: 'Photo 2 of a series of 3 – compare' }).click()
	const compare = page.getByRole('dialog', { name: 'Series of 3 · photo 2' })
	await compare.getByRole('button', { name: 'Pick this, reject the rest' }).click()

	await expect(compare).toBeHidden()
	await expect(loupe.getByRole('heading', { name: 'IMG_0004' })).toBeVisible()
})

// spec: LOUPE-002.15
test('picks the shown photo by the loupe\'s own Pick this, reject the rest and lands after the series', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Series pick rest ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:00:02'], ['IMG_0004', '10:05:00']]) {
		await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()

	await loupe.getByRole('button', { name: 'Pick this, reject the rest' }).click()

	await expect(page.getByText('Picked IMG_0002, rejected the rest')).toBeVisible()
	await expect(loupe.getByRole('heading', { name: 'IMG_0004' })).toBeVisible()
})

// spec: LOUPE-002.16
test('offers Reject the other 2 in the toast after a plain Pick and lands after the series', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Series reject others ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:00:02'], ['IMG_0004', '10:05:00']]) {
		await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()

	await loupe.getByRole('button', { name: 'Pick', exact: true }).click()
	await page.getByRole('status').getByRole('button', { name: 'Reject the other 2' }).click()

	await expect(page.getByText('Picked IMG_0002, rejected the rest')).toBeVisible()
	await expect(loupe.getByRole('heading', { name: 'IMG_0004' })).toBeVisible()
})
