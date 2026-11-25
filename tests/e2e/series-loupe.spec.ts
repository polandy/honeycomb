// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { apiHeaders, createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'

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

	await loupe.getByRole('button', { name: 'Series 2/3: compare' }).click()
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

// spec: LOUPE-001.26, LOUPE-003.6
test('shows the first-series hint once, under a chip that does not pulse with reduced motion', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' })
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page, false)
	const folder = `Series hint ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:05:00']]) {
		await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`))
	}
	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0003, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	const hint = loupe.getByRole('dialog', { name: 'Series hint' })
	await expect(hint).toBeHidden()

	await page.keyboard.press('ArrowLeft')
	await expect(hint).toContainText('This photo is part of a series of 2.')
	await expect(loupe.getByRole('button', { name: 'Series 2/2: compare' })).toHaveCSS('animation-name', 'none')
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/view-state') && response.request().method() === 'PUT' && response.request().postDataJSON().viewState.series_hint_seen === true && response.ok())
	await hint.getByRole('button', { name: 'Got it' }).click()

	await expect(hint).toBeHidden()
	await saved
	await cullFolder(page, folder)
	await page.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
	await expect(loupe.getByRole('heading', { name: 'IMG_0001' })).toBeVisible()
	await expect(hint).toBeHidden()
})

// spec: LOUPE-001.19, LOUPE-002.15, SERIES-001.9
test('frames a series in one across its rejected photo, and pick-rest and its undo touch only that series', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `Series frame rejected ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const ids = new Map<string, number>()
	for (const [name, time] of [['IMG_0001', '10:00:00'], ['IMG_0002', '10:00:01'], ['IMG_0003', '10:00:02'], ['IMG_0004', '10:00:03'], ['IMG_0005', '10:05:00'], ['IMG_0006', '10:05:01']] as const) {
		ids.set(name, await upload(page, `${folder}/${name}.jpg`, withCaptureTime(JPEG, `2026:11:10 ${time}`)))
	}
	const rejected = await page.request.put(`${API}/flags`, { data: { flags: [{ fileId: ids.get('IMG_0003'), flag: 'rejected', keepRaw: false }] }, headers: await apiHeaders(page) })
	expect(rejected.status(), await rejected.text()).toBe(200)
	await cullFolder(page, folder)
	await page.locator('.flag-filter').getByRole('button', { name: 'Rejected', exact: true }).click()
	await expect(page.getByRole('gridcell', { name: 'IMG_0003, JPG only' })).toBeVisible()
	await page.getByRole('gridcell', { name: 'IMG_0002, JPG only' }).click()
	const loupe = page.getByRole('dialog', { name: 'Loupe' })
	await loupe.getByRole('dialog', { name: 'How to cull' }).getByRole('button', { name: 'Got it' }).click()
	const filmstrip = loupe.getByRole('navigation', { name: 'Filmstrip' })

	await expect(filmstrip.getByRole('button', { name: 'Series of 3 – compare' })).toHaveCount(1)
	const { frame, first, last } = await filmstrip.evaluate((element) => {
		const box = (selector: string) => element.querySelector(selector)!.getBoundingClientRect().toJSON() as DOMRect
		return { frame: box('.loupe-filmstrip__frame'), first: box('[aria-label="IMG_0001"]'), last: box('[aria-label="IMG_0004"]') }
	})
	expect(frame.x + frame.width).toBe(last.x + last.width)
	expect(frame.x).toBeLessThan(first.x)

	const flags = async () => {
		const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers: await apiHeaders(page) })
		const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null }[] }
		const byId = new Map(entries.map(({ fileId, flag }) => [fileId, flag ?? 'unflagged']))
		return Object.fromEntries([...ids].map(([name, fileId]) => [name, byId.get(fileId)]))
	}
	await loupe.getByRole('button', { name: 'Pick this, reject the rest' }).click()
	await expect(page.getByText('Picked IMG_0002, rejected the rest')).toBeVisible()
	await expect.poll(flags).toEqual({ IMG_0001: 'rejected', IMG_0002: 'picked', IMG_0003: 'rejected', IMG_0004: 'rejected', IMG_0005: 'unflagged', IMG_0006: 'unflagged' })

	await page.getByRole('status').getByRole('button', { name: 'Undo' }).click()
	await expect.poll(flags).toEqual({ IMG_0001: 'unflagged', IMG_0002: 'unflagged', IMG_0003: 'rejected', IMG_0004: 'unflagged', IMG_0005: 'unflagged', IMG_0006: 'unflagged' })
})
