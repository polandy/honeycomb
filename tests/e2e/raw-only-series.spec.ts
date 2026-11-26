// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, rawWithCaptureTime, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

// spec: LISTING-004.11, LISTING-004.13
test('puts a RAW-only shot into its burst\'s series by the capture time in its header, and Pick this, reject the rest rejects it', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `RAW-only series ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const ids = new Map<string, number>()
	ids.set('IMG_0001', await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00')))
	ids.set('IMG_0002', await upload(page, `${folder}/IMG_0002.NEF`, rawWithCaptureTime('2026:11:10 10:00:01')))
	ids.set('IMG_0003', await upload(page, `${folder}/IMG_0003.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:02')))

	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell', { name: 'IMG_0002, NEF only' })).toBeVisible()
	await page.keyboard.press('n')
	const dialog = page.getByRole('dialog', { name: 'Compare series 1 of 1' })
	const raw = dialog.getByRole('button', { name: 'Photo 2: IMG_0002' })
	await expect(dialog.locator('.series-compare__card')).toHaveCount(3)
	await expect.poll(() => raw.locator('img').evaluate((image: HTMLImageElement) => image.complete ? image.naturalWidth : 0)).toBeGreaterThan(0)

	await dialog.getByRole('button', { name: 'Pick this, reject the rest' }).click()

	await expect(page.getByRole('status')).toContainText('Picked 1, rejected 2')
	const flags = async () => {
		const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers: await apiHeaders(page) })
		const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null }[] }
		const byId = new Map(entries.map(({ fileId, flag }) => [fileId, flag ?? 'unflagged']))
		return Object.fromEntries([...ids].map(([name, fileId]) => [name, byId.get(fileId)]))
	}
	await expect.poll(flags).toEqual({ IMG_0001: 'picked', IMG_0002: 'rejected', IMG_0003: 'rejected' })
})
