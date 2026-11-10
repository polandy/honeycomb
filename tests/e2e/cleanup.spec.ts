// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { createFolder, JPEG, requestToken, trashEntry, upload } from './files.ts'
import { logIn, occ } from './server.ts'

const API = '/index.php/apps/honeycomb/api/v1'
const JOB = 'OCA\\Honeycomb\\BackgroundJob\\RemoveVanishedDecisions'

/** Sends `data` as JSON with the session's CSRF token. */
async function send(page: Page, method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, data?: unknown) {
	return page.request.fetch(path, { method, data, headers: { requesttoken: await requestToken(page) } })
}

/** Runs the clean-up job now, whatever its interval. */
function runCleanUp(): void {
	const jobs = JSON.parse(occ(['background-job:list', `--class=${JOB}`, '--output=json'])) as { id: number }[]
	expect(jobs).toHaveLength(1)
	occ(['background-job:execute', String(jobs[0]?.id), '--force-execute'])
}

// spec: DECISIONS-001.11
test('the clean-up job removes the decisions of a file deleted for good', async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
	const folder = `Clean-up ${randomUUID().slice(0, 8)}`
	await createFolder(page, folder)
	const gone = await upload(page, `${folder}/IMG_0001.jpg`, JPEG)
	const kept = await upload(page, `${folder}/IMG_0002.jpg`, JPEG)
	const decisions = [gone, kept].map((fileId) => ({ fileId, rating: 3, colourLabel: null, flag: 'picked', keepRaw: false }))
	expect((await send(page, 'PUT', `${API}/decisions`, { decisions })).status()).toBe(204)
	const lookup = async () => (await (await send(page, 'POST', `${API}/decisions/lookup`, { fileIds: [gone, kept] })).json()) as unknown

	expect((await send(page, 'DELETE', `/remote.php/dav/files/${ADMIN.username}/${folder}/IMG_0001.jpg`)).status()).toBe(204)
	runCleanUp()
	expect(await lookup()).toEqual({ decisions })

	expect((await send(page, 'DELETE', await trashEntry(page, `${folder}/IMG_0001.jpg`))).status()).toBe(204)
	expect(await lookup()).toEqual({ decisions })
	runCleanUp()
	expect(await lookup()).toEqual({ decisions: [decisions[1]] })
	runCleanUp()
	expect(await lookup()).toEqual({ decisions: [decisions[1]] })
})

// spec: DECISIONS-001.12, DECISIONS-002.13
test('deleting a user removes their decisions and positions', async ({ browser }) => {
	const user = { username: `gone-${randomUUID().slice(0, 8)}`, password: `e2e-${randomUUID()}` }
	const addUser = () => occ(['user:add', '--password-from-env', user.username], { OC_PASS: user.password })
	const asUser = async (act: (page: Page) => Promise<void>) => {
		const context = await browser.newContext({ storageState: { cookies: [], origins: [] } })
		const page = await context.newPage()
		await logIn(page, user)
		await page.goto('/index.php/apps/honeycomb/')
		await act(page)
		await context.close()
	}
	const decision = { fileId: 900_100, rating: 2, colourLabel: 'red', flag: 'rejected', keepRaw: false }
	const position = { folderSet: { paths: ['/Trip'], subfolders: false }, fileId: 900_100, decided: 1, total: 2 }
	addUser()
	await asUser(async (page) => {
		expect((await send(page, 'PUT', `${API}/decisions`, { decisions: [decision] })).status()).toBe(204)
		expect((await send(page, 'PUT', `${API}/positions`, position)).status()).toBe(200)
	})

	occ(['user:delete', user.username])
	addUser()

	await asUser(async (page) => {
		expect(await (await send(page, 'POST', `${API}/decisions/lookup`, { fileIds: [decision.fileId] })).json()).toEqual({ decisions: [] })
		expect(await (await send(page, 'GET', `${API}/positions`)).json()).toEqual({ positions: [] })
	})
})
