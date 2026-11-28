// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { apiHeaders, createFolder, JPEG, upload, withCaptureTime } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const HASH = /^[0-9a-f]{16}$/
const SOFT = readFileSync('tests/fixtures/images/series-soft.jpg')
const SHARP = readFileSync('tests/fixtures/images/series-sharp.jpg')

// spec: SERIES-004.13, SERIES-004.1
test('computes the missing hashes of a folder tree in workers and stores them', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/similarity')
	const folder = `Similarity ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await createFolder(page, `${folder}/2026`)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/2026/IMG_0002.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:10'))
	const missing = async () => {
		const answer = await page.request.get(`${API}/visual-hashes/missing`, { params: { path: `/${folder}`, cursor: '', method: 1 }, headers: await apiHeaders(page) })
		expect(answer.status(), await answer.text()).toBe(200)
		return answer.json() as Promise<{ pictures: { path: string }[], nextCursor: string | null }>
	}
	expect((await missing()).pictures.map((picture) => picture.path)).toEqual([`/${folder}/2026/IMG_0002.jpg`, `/${folder}/IMG_0001.jpg`])
	await page.reload()

	await page.getByRole('treeitem', { name: folder }).click()
	await page.getByRole('button', { name: 'Start' }).click()

	await expect(page.getByText('Done: every photo in this folder has its similarity.')).toBeVisible()
	expect(await missing()).toEqual({ pictures: [], nextCursor: null })
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}/2026` }, headers: await apiHeaders(page) })
	const entries = (await listing.json() as { entries: { visualHash: { method: number, hash: string } | null }[] }).entries
	expect(entries[0]!.visualHash).toEqual({ method: 1, hash: expect.stringMatching(HASH) })
})

// spec: SERIES-004.22
test('measures the sharpness of the series members of a folder tree once their hashes are done', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/similarity')
	const folder = `Sharpness ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await createFolder(page, `${folder}/Burst`)
	await upload(page, `${folder}/Burst/IMG_0001.jpg`, withCaptureTime(SOFT, '2026:11:10 10:00:00'))
	await upload(page, `${folder}/Burst/IMG_0002.jpg`, withCaptureTime(SHARP, '2026:11:10 10:00:01'))
	await upload(page, `${folder}/IMG_0003.jpg`, withCaptureTime(JPEG, '2026:11:10 12:00:00'))
	await page.reload()
	const saved = page.waitForResponse((response) => response.url().endsWith('/api/v1/quality-values') && response.request().method() === 'PUT' && response.ok())

	await page.getByRole('treeitem', { name: folder }).click()
	await page.getByRole('button', { name: 'Start' }).click()

	await expect(page.getByText('Done: every photo of a series in this folder has its sharpness.')).toBeVisible()
	await expect(page.locator('.similarity-page__counts').nth(1)).toHaveText('To measure2Measured2Failed0Left0')
	await saved
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}`, subfolders: 1 }, headers: await apiHeaders(page) })
	const entries = (await listing.json() as { entries: { path: string, quality: { method: number, sharpness: number } | null }[] }).entries
	const quality = (name: string) => entries.find((entry) => entry.path.endsWith(name))!.quality
	expect(quality('IMG_0001.jpg')).toEqual({ method: 1, sharpness: expect.any(Number), focusTile: expect.any(Number) })
	expect(quality('IMG_0002.jpg')!.sharpness).toBeGreaterThan(quality('IMG_0001.jpg')!.sharpness)
	expect(quality('IMG_0003.jpg')).toBeNull()
})
