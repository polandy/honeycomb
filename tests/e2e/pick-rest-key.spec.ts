// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const NAMES = ['IMG_0001', 'IMG_0002', 'IMG_0003', 'IMG_0004'] as const

/** A folder of a series of three and one photo five minutes later, IMG_0001 already picked, culled with the rejected photos shown. */
async function cullSeries(page: Page) {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Pick rest key ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const ids = new Map<string, number>()
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:00:02'], ['IMG_0004', '10:05:00']] as const) {
		ids.set(name, await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`)))
	}
	const picked = await page.request.put(`${API}/flags`, { data: { flags: [{ fileId: ids.get('IMG_0001'), flag: 'picked', keepRaw: false }] }, headers: await apiHeaders(page) })
	expect(picked.status(), await picked.text()).toBe(200)
	await cullFolder(page, folder)
	await page.locator('.flag-filter').getByRole('button', { name: 'Rejected', exact: true }).click()
	return { folder, ids }
}

/** The flag each grid tile shows by its mark, `none` for an undecided tile. */
async function tileFlags(page: Page) {
	return Object.fromEntries(await Promise.all(NAMES.map(async (name) => {
		const mark = page.getByRole('gridcell', { name: `${name}, JPG only` }).locator('.flag-mark')
		const classes = await mark.count() === 0 ? '' : await mark.getAttribute('class') ?? ''
		return [name, /flag-mark--(\w+)/.exec(classes)?.[1] ?? 'none'] as const
	})))
}

/** Opens the loupe on the photo by its tile and dismisses the gesture guide. */
async function openLoupeOn(page: Page, name: string) {
	await page.getByRole('gridcell', { name: `${name}, JPG only` }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	return loupe
}

// spec: KEYS-001.13
test('picks the shown photo by Shift+P, rejects every other photo of its series, the picked one too, and one undo gives every label back', async ({ page }) => {
	const { folder, ids } = await cullSeries(page)
	const loupe = await openLoupeOn(page, 'IMG_0002')

	await page.keyboard.press('Shift+P')

	await expect(page.getByRole('status')).toContainText('Picked 1, rejected 2')
	await expect(loupe.getByRole('heading', { name: 'IMG_0004' })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect(loupe).toBeHidden()
	await expect.poll(() => tileFlags(page)).toEqual({ IMG_0001: 'rejected', IMG_0002: 'picked', IMG_0003: 'rejected', IMG_0004: 'none' })
	const flags = async () => {
		const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers: await apiHeaders(page) })
		const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null }[] }
		const byId = new Map(entries.map(({ fileId, flag }) => [fileId, flag ?? 'unflagged']))
		return Object.fromEntries([...ids].map(([name, fileId]) => [name, byId.get(fileId)]))
	}
	await expect.poll(flags).toEqual({ IMG_0001: 'rejected', IMG_0002: 'picked', IMG_0003: 'rejected', IMG_0004: 'unflagged' })

	await page.keyboard.press('Control+z')

	await expect.poll(() => tileFlags(page)).toEqual({ IMG_0001: 'picked', IMG_0002: 'none', IMG_0003: 'none', IMG_0004: 'none' })
	await expect.poll(flags).toEqual({ IMG_0001: 'picked', IMG_0002: 'unflagged', IMG_0003: 'unflagged', IMG_0004: 'unflagged' })
})

// spec: KEYS-001.13
test('changes no label and shows a short hint by Shift+P on a photo outside a series', async ({ page }) => {
	await cullSeries(page)
	const loupe = await openLoupeOn(page, 'IMG_0004')

	await page.keyboard.press('Shift+P')

	await expect(page.getByRole('status')).toContainText('Not in a series · Shift+P picks a photo and rejects the rest of its series')
	await expect(loupe.getByRole('heading', { name: 'IMG_0004' })).toBeVisible()
	await page.keyboard.press('Escape')
	await expect.poll(() => tileFlags(page)).toEqual({ IMG_0001: 'picked', IMG_0002: 'none', IMG_0003: 'none', IMG_0004: 'none' })
})
