// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Browser, Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { createFolder, JPEG, requestToken, trashEntry, upload } from './files.ts'
import { logIn, occ } from './server.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const TRASHBIN = `/remote.php/dav/trashbin/${ADMIN.username}`
const JOB = 'OCA\\Honeycomb\\BackgroundJob\\RemoveVanishedDecisions'

/** Sends `data` as JSON with the session's CSRF token. */
async function send(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) {
	return page.request.fetch(path, { method, data, headers: { requesttoken: await requestToken(page) } })
}

/** Signs `user` in on a fresh context, opens the app and hands the page to `act`. */
async function asUser(browser: Browser, user: { username: string, password: string }, act: (page: Page) => Promise<void>): Promise<void> {
	const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
	const page = await context.newPage()
	await logIn(page, user)
	await page.goto('/index.php/apps/honeycomb/')
	await act(page)
	await context.close()
}

/** Runs the clean-up job now, whatever its interval. */
function runCleanUp(): void {
	const jobs = JSON.parse(occ(['background-job:list', `--class=${JOB}`, '--output=json'])) as { id: number }[]
	expect(jobs).toHaveLength(1)
	occ(['background-job:execute', String(jobs[0]?.id), '--force-execute'])
}

/** The flags of the folder's entries by file id, as the listing carries them. */
async function flagsOf(page: Page, folder: string) {
	const listing = await send(page, 'GET', `${API}/entries?path=${encodeURIComponent(`/${folder}`)}`)
	expect(listing.status(), await listing.text()).toBe(200)
	const { entries } = await listing.json() as { entries: { fileId: number, flag: string | null }[] }
	return new Map(entries.map(({ fileId, flag }) => [fileId, flag]))
}

/** Saves `flag` for each of the files. */
async function flag(page: Page, fileIds: number[], flag: string): Promise<void> {
	const saved = await send(page, 'PUT', `${API}/flags`, { flags: fileIds.map((fileId) => ({ fileId, flag, keepRaw: false })) })
	expect(saved.status(), await saved.text()).toBe(200)
}

/** Moves the trashed file back to where it was. */
async function restore(page: Page, path: string): Promise<void> {
	const restored = await page.request.fetch(await trashEntry(page, path), { method: 'MOVE', headers: { requesttoken: await requestToken(page), Destination: `${TRASHBIN}/restore/${randomUUID()}` } })
	expect(restored.status(), await restored.text()).toBe(201)
}

// spec: DECISIONS-001.11, DECISIONS-001.31
test('the clean-up job removes the flags of a file deleted for good', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Clean-up ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const gone = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	const kept = await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await flag(page, [gone, kept], 'picked')

	expect((await send(page, 'DELETE', `/remote.php/dav/files/${ADMIN.username}/${folder}/IMG_0001.jpg`)).status()).toBe(204)
	expect((await send(page, 'DELETE', await trashEntry(page, `${folder}/IMG_0001.jpg`))).status()).toBe(204)
	runCleanUp()

	expect(await flagsOf(page, folder)).toEqual(new Map([[kept, 'picked']]))
	const taken = await send(page, 'POST', `${API}/flags/take-over`, { flags: [{ fileId: kept, flag: 'rejected', keepRaw: false }] })
	expect(await taken.json()).toEqual({ saved: [], skipped: [{ fileId: kept, reason: 'exists' }] })
})

// spec: DECISIONS-001.32
test('occ honeycomb:cleanup removes the flags of a file in the trash bin', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Orphaned ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const trashed = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	const kept = await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	await flag(page, [trashed, kept], 'rejected')
	expect((await send(page, 'DELETE', `/remote.php/dav/files/${ADMIN.username}/${folder}/IMG_0001.jpg`)).status()).toBe(204)

	expect(occ(['honeycomb:cleanup'])).toMatch(/Removed [1-9]\d* orphaned flag rows?\./)
	await restore(page, `${folder}/IMG_0001.jpg`)

	expect(await flagsOf(page, folder)).toEqual(new Map([[trashed, null], [kept, 'rejected']]))
})

// spec: SETTINGS-001.27
test('cleans up orphaned data for an admin and refuses another user', async ({ browser, page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const cleaned = await send(page, 'POST', `${API}/cleanup`)
	expect(cleaned.status(), await cleaned.text()).toBe(200)
	expect(await cleaned.json()).toEqual({ removed: expect.any(Number) as number })

	const user = { username: `plain-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	await asUser(browser, user, async (other) => {
		expect((await send(other, 'POST', `${API}/cleanup`)).status()).toBe(403)
	})
	occ(['user:delete', user.username])
})

// spec: DECISIONS-002.13
test('deleting a user removes their positions', async ({ browser }) => {
	const user = { username: `gone-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	const addUser = () => occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	const position = { folderSet: { paths: ['/Trip'], subfolders: false }, fileId: 900_100, decided: 1, total: 2 }
	addUser()
	await asUser(browser, user, async (page) => {
		expect((await send(page, 'PUT', `${API}/positions`, position)).status()).toBe(200)
	})

	occ(['user:delete', user.username])
	addUser()

	await asUser(browser, user, async (page) => {
		expect(await (await send(page, 'GET', `${API}/positions`)).json()).toEqual({ positions: [] })
	})
})
