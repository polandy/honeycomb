// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { cullFolder, resetViewState } from './cull.ts'
import { createFolder, JPEG, rawWithCaptureTime, upload, withCaptureTime } from './files.ts'
import { occ, sql } from './server.ts'

const JOB = 'OCA\\Honeycomb\\BackgroundJob\\ReadRawHeaders'

/** The compare dialog of the folder's one series, opened from the grid. */
async function compare(page: Page, folder: string) {
	await cullFolder(page, folder)
	await expect(page.getByRole('gridcell', { name: 'IMG_0002, NEF only' })).toBeVisible()
	await page.keyboard.press('n')
	return page.getByRole('dialog', { name: 'Compare series 1 of 1' })
}

/** Runs the queued header job of the file now. */
function runJobOf(fileId: number): void {
	const jobs = JSON.parse(occ(['background-job:list', `--class=${JOB}`, '--output=json'])) as { id: number, argument: string }[]
	const job = jobs.find(({ argument }) => (JSON.parse(argument) as { fileIds: number[] }).fileIds.includes(fileId))
	expect(job, `no ${JOB} job for file ${fileId}`).toBeDefined()
	occ(['background-job:execute', String(job?.id), '--force-execute'])
}

// spec: LISTING-004.14, LISTING-004.17
test('reads the header of a RAW file written before honeycomb once the folder is listed, so it joins its burst\'s series', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	await resetViewState(page)
	const folder = `RAW backfill ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	await upload(page, `${folder}/IMG_0001.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:00'))
	const raw = await upload(page, `${folder}/IMG_0002.NEF`, rawWithCaptureTime('2026:11:10 10:00:01'))
	await upload(page, `${folder}/IMG_0003.jpg`, withCaptureTime(JPEG, '2026:11:10 10:00:02'))
	sql('DELETE FROM *PREFIX*files_metadata WHERE file_id = ?', [raw])

	await expect((await compare(page, folder)).locator('.series-compare__card')).toHaveCount(2)
	runJobOf(raw)

	const dialog = await compare(page, folder)
	await expect(dialog.locator('.series-compare__card')).toHaveCount(3)
	const card = dialog.getByRole('button', { name: 'Photo 2: IMG_0002' })
	await expect.poll(() => card.locator('img').evaluate((image: HTMLImageElement) => image.complete ? image.naturalWidth : 0)).toBeGreaterThan(0)
})
