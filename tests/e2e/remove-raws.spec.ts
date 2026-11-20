// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { apiHeaders, createFolder, JPEG, RAW, upload } from './files.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const SIDECAR = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>')
const RATED = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/" xmlns:digiKam="http://www.digikam.org/ns/1.0/" xmp:Rating="3" xmp:Label="Red" digiKam:PickLabel="3"><digiKam:TagsList><rdf:Seq><rdf:li>Places/Lisbon</rdf:li></rdf:Seq></digiKam:TagsList></rdf:Description></rdf:RDF></x:xmpmeta>')
const KEEP_RAW = Buffer.from('<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:honeycomb="https://github.com/polandy/honeycomb/xmp/1.0/" honeycomb:KeepRaw="True"/></rdf:RDF></x:xmpmeta>')

/** Culls a new folder of NEF+JPEG pairs once the flags are taken over and returns its name and the members' file ids. */
async function cullPairs(page: Page, names: readonly string[], sidecar: Buffer = SIDECAR): Promise<{ folder: string, jpegs: number[], raws: number[] }> {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Raws ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const jpegs: number[] = []
	const raws: number[] = []
	for (const name of names) {
		jpegs.push(await upload(page, `${folder}/${name}.jpg`, JPEG))
		raws.push(await upload(page, `${folder}/${name}.NEF`, RAW))
		await upload(page, `${folder}/${name}.NEF.xmp`, sidecar)
	}
	const takenOver = page.waitForResponse((response) => response.url().endsWith('/api/v1/flags/take-over') && response.ok())
	await cullFolder(page, folder)
	await expect(page.getByRole('grid', { name: 'Photos' }).getByRole('gridcell')).toHaveCount(names.length)
	await takenOver
	return { folder, jpegs, raws }
}

/** Opens the Remove RAWs summary and confirms it. */
async function removeRaws(page: Page): Promise<void> {
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: /^Remove RAWs… / }).click()
	const summary = page.getByRole('dialog', { name: /^Remove the RAWs? of/ })
	await summary.getByRole('button', { name: /^Move \d+ files to trash$/ }).click()
	await expect(summary).toBeHidden()
}

/** The original locations of the files in the trash bin. */
async function trashLocations(page: Page): Promise<string> {
	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: await apiHeaders(page, { Depth: '1' }),
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	return trash.text()
}

// spec: DELETE-003.4, DELETE-003.6
test('removes only the RAW and its own sidecar of each pair not kept, after one is kept in the summary', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Raws ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	for (const name of ['IMG_0001', 'IMG_0002']) {
		await upload(page, `${folder}/${name}.jpg`, JPEG)
		await upload(page, `${folder}/${name}.NEF`, RAW)
	}
	await upload(page, `${folder}/IMG_0001.NEF.xmp`, SIDECAR)
	await upload(page, `${folder}/IMG_0001.xmp`, SIDECAR)

	await cullFolder(page, folder)
	const grid = page.getByRole('grid', { name: 'Photos' })
	await expect(grid.getByRole('gridcell')).toHaveCount(2)
	await page.getByRole('button', { name: 'More' }).click()
	await page.getByRole('button', { name: /Remove RAWs… 2/ }).click()

	const summary = page.getByRole('dialog', { name: /^Remove the RAWs? of/ })
	await expect(summary).toHaveAccessibleName('Remove the RAWs of 2 photos')
	await summary.getByRole('button', { name: /^IMG_0002.*Keep RAW$/ }).click()
	await expect(summary).toHaveAccessibleName('Remove the RAW of 1 photo')
	await expect(summary.getByRole('button', { name: /^IMG_0002.*Remove RAW$/ })).toBeVisible()
	await summary.getByRole('button', { name: 'Move 2 files to trash' }).click()

	await expect(summary).toBeHidden()
	await expect(page.getByRole('status').filter({ hasText: 'Removed the RAWs of 1 photo · 2 files' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: 'IMG_0001, JPG only' })).toBeVisible()
	await expect(grid.getByRole('gridcell', { name: /^IMG_0002, JPG\+NEF/ })).toBeVisible()

	const trash = await page.request.fetch(`/remote.php/dav/trashbin/${ADMIN.username}/trash`, {
		method: 'PROPFIND',
		headers: await apiHeaders(page, { Depth: '1' }),
		data: '<d:propfind xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns"><d:prop><nc:trashbin-original-location/></d:prop></d:propfind>',
	})
	const locations = await trash.text()
	for (const file of ['IMG_0001.NEF', 'IMG_0001.NEF.xmp']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	for (const file of ['IMG_0001.jpg', 'IMG_0001.xmp', 'IMG_0002.NEF']) {
		expect(locations).not.toContain(`${folder}/${file}<`)
	}
})

// spec: DELETE-003.11
test('keeps the RAW another user marked Keep RAW after the summary opened, and removes the others', async ({ page }) => {
	const { folder, jpegs, raws } = await cullPairs(page, ['IMG_0001', 'IMG_0002', 'IMG_0003'])
	const flags = [jpegs[1], raws[1]].map((fileId) => ({ fileId, flag: 'unflagged', keepRaw: true }))
	const kept = await page.request.put(`${API}/flags`, { data: { flags }, headers: await apiHeaders(page) })
	expect(kept.status()).toBe(200)
	await upload(page, `${folder}/IMG_0003.NEF.xmp`, KEEP_RAW)
	const sidecarLookups: string[] = []
	page.on('request', (request) => {
		if (/\/api\/v1\/(sidecars|embedded-xmp)\/lookup$/.test(request.url())) {
			sidecarLookups.push(request.url())
		}
	})

	await removeRaws(page)

	const report = page.getByRole('dialog', { name: 'Some photos were skipped' })
	await expect(report.getByRole('list', { name: 'Photos skipped' })).toContainText('Now rejected or kept with Keep RAW')
	const locations = await trashLocations(page)
	for (const file of ['IMG_0001.NEF', 'IMG_0003.NEF']) {
		expect(locations).toContain(`${folder}/${file}<`)
	}
	expect(locations).not.toContain(`${folder}/IMG_0002.NEF<`)
	expect(sidecarLookups).toEqual([])
})

// spec: DELETE-003.12
test('writes the rating, colour label and tags to the JPEG sidecar but no flag, and keeps the JPEG picked', async ({ page }) => {
	const { folder, jpegs } = await cullPairs(page, ['IMG_0001'], RATED)

	await removeRaws(page)

	await expect(page.getByRole('status').filter({ hasText: 'Removed the RAWs of 1 photo' })).toBeVisible()
	const headers = await apiHeaders(page)
	const written = await (await page.request.get(`/remote.php/dav/files/${ADMIN.username}/${folder}/IMG_0001.jpg.xmp`, { headers })).text()
	expect(written).toMatch(/xmp:Rating(="|>)3/)
	expect(written).toMatch(/xmp:Label(="|>)Red/)
	expect(written).toContain('Places/Lisbon')
	expect(written).not.toContain('PickLabel')
	const listing = await page.request.get(`${API}/entries`, { params: { path: `/${folder}` }, headers })
	const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null }[] }
	expect(entries.find((entry) => entry.fileId === jpegs[0])?.flag).toBe('picked')
	expect(await trashLocations(page)).toContain(`${folder}/IMG_0001.NEF<`)
})
