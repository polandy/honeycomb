// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { etagOf, JPEG, RAW, requestToken, trashEntry, upload } from './files.ts'
import { occ } from './server.ts'

const API = '/index.php/apps/honeycomb/api/v1'
/** The folder the e2e image's hook makes for local External Storage. */
const EXTERNAL_DIR = '/tmp/honeycomb-e2e-external'
const PAIR = ['IMG_0001.jpg', 'IMG_0001.NEF']

/** Uploads a JPEG+NEF pair into `folder` and returns its files as the trash endpoint takes them. */
async function uploadPair(page: Page, folder: string): Promise<{ fileId: number, etag: string }[]> {
	const files = []
	for (const [name, content] of [[PAIR[0], JPEG], [PAIR[1], RAW]] as const) {
		const fileId = await upload(page, `${folder}/${name}`, content)
		files.push({ fileId, etag: await etagOf(page, `${folder}/${name}`) })
	}
	return files
}

/** Posts one picture to the trash endpoint and returns each file's result. */
async function trash(page: Page, picture: { fileId: number, etag: string }[]): Promise<string[]> {
	const response = await page.request.post(`${API}/trash`, { data: { pictures: [picture] }, headers: { requesttoken: await requestToken(page) } })
	expect(response.status(), await response.text()).toBe(200)
	const body = await response.json() as { pictures: { result: string }[][] }
	return body.pictures.flat().map(({ result }) => result)
}

/** Runs `body` with a Team folder of the admin's group mounted at `name`, removed afterwards. */
async function withTeamFolder(name: string, body: () => Promise<void>): Promise<void> {
	const id = occ(['groupfolders:create', name]).trim()
	try {
		occ(['groupfolders:group', id, ADMIN.username, 'write', 'share', 'delete'])
		await body()
	} finally {
		occ(['groupfolders:delete', '--force', id])
	}
}

/** Runs `body` with local External Storage mounted for the admin at `name`, removed afterwards. */
async function withExternalStorage(name: string, body: () => Promise<void>): Promise<void> {
	const created = occ(['files_external:create', `/${name}`, 'local', 'null::null', '-c', `datadir=${EXTERNAL_DIR}`, `--applicable-user=${ADMIN.username}`])
	const id = /\d+/.exec(created)?.[0] ?? ''
	try {
		await body()
	} finally {
		occ(['files_external:delete', '--yes', id])
	}
}

test.beforeEach(async ({ page }) => {
	await page.goto('/index.php/apps/honeycomb/')
})

// spec: DELETE-001.10
test('trashes a pair in a Team folder into the trash bin', async ({ page }) => {
	const mount = `Team ${randomUUID().slice(0, 8)}`
	await withTeamFolder(mount, async () => {
		const picture = await uploadPair(page, mount)

		expect(await trash(page, picture)).toEqual(['trashed', 'trashed'])
		for (const name of PAIR) {
			await trashEntry(page, `${mount}/${name}`)
		}
	})
})

// spec: DELETE-001.10
test('trashes a pair on local External Storage into the trash bin', async ({ page }) => {
	const mount = `External ${randomUUID().slice(0, 8)}`
	await withExternalStorage(mount, async () => {
		const picture = await uploadPair(page, mount)

		expect(await trash(page, picture)).toEqual(['trashed', 'trashed'])
		for (const name of PAIR) {
			await trashEntry(page, `${mount}/${name}`)
		}
	})
})

// spec: DELETE-001.9
test('refuses a picture whose files the trash bin would delete for good', async ({ page }) => {
	const mount = `External ${randomUUID().slice(0, 8)}`
	await withExternalStorage(mount, async () => {
		const picture = await uploadPair(page, mount)
		// The admin's own limit: the web process caches app config that occ changes behind its back.
		occ(['user:setting', ADMIN.username, 'files_trashbin', 'trashbin_size', String(JPEG.length)])
		try {
			expect(await trash(page, picture)).toEqual(['noTrashBin', 'noTrashBin'])
			for (const name of PAIR) {
				expect(await etagOf(page, `${mount}/${name}`)).not.toBe('')
			}
		} finally {
			occ(['user:setting', '--delete', ADMIN.username, 'files_trashbin', 'trashbin_size'])
		}
	})
})
