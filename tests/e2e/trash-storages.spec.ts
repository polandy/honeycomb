// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Page } from '@playwright/test'

import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { ADMIN } from './admin.ts'
import { cullFolder } from './cull.ts'
import { apiHeaders, etagOf, exists, JPEG, RAW, trashEntry, trashLocations, upload, withSmallTrashBin } from './files.ts'
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
async function trash(page: Page, picture: { fileId: number, etag: string, permanent?: boolean }[]): Promise<string[]> {
	const response = await page.request.post(`${API}/trash`, { data: { pictures: [picture] }, headers: await apiHeaders(page) })
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
		await withSmallTrashBin(async () => {
			expect(await trash(page, picture)).toEqual(['tooLarge', 'tooLarge'])
			for (const name of PAIR) {
				expect(await etagOf(page, `${mount}/${name}`)).not.toBe('')
			}
		})
	})
})

// spec: DELETE-001.11
test('deletes for good only the files marked permanent, and trashes a marked file the trash bin keeps', async ({ page }) => {
	const mount = `External ${randomUUID().slice(0, 8)}`
	await withExternalStorage(mount, async () => {
		const [jpeg, raw] = await uploadPair(page, mount)
		await withSmallTrashBin(async () => {
			expect(await trash(page, [{ ...jpeg!, permanent: true }, raw!])).toEqual(['skipped', 'tooLarge'])
			expect(await trash(page, [{ ...jpeg!, permanent: true }, { ...raw!, permanent: true }])).toEqual(['deleted', 'deleted'])
		})
		const locations = await trashLocations(page)
		for (const name of PAIR) {
			expect(await exists(page, `${mount}/${name}`)).toBe(false)
			expect(locations).not.toContain(`${mount}/${name}<`)
		}
	})
})

// spec: DELETE-001.9, DELETE-001.11
test('trashes a Team folder pair past the trash bin size, since a Team folder keeps it, even when marked permanent', async ({ page }) => {
	const mount = `Team ${randomUUID().slice(0, 8)}`
	await withTeamFolder(mount, async () => {
		const [jpeg, raw] = await uploadPair(page, mount)
		await withSmallTrashBin(async () => {
			expect(await trash(page, [jpeg!, { ...raw!, permanent: true }])).toEqual(['trashed', 'trashed'])
		})
		for (const name of PAIR) {
			await trashEntry(page, `${mount}/${name}`)
		}
	})
})

// spec: DELETE-002.20, DELETE-002.21, DELETE-002.24
test('warns before deleting a photo the trash bin would not keep, with Cancel focused, then deletes it for good', async ({ page }) => {
	const mount = `External ${randomUUID().slice(0, 8)}`
	await withExternalStorage(mount, async () => {
		await upload(page, `${mount}/IMG_0001.jpg`, JPEG)
		await withSmallTrashBin(async () => {
			await cullFolder(page, mount)
			const grid = page.getByRole('grid', { name: 'Photos' })
			await page.getByRole('button', { name: 'Select', exact: true }).click()
			await grid.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
			await page.getByRole('button', { name: 'Delete…', exact: true }).click()
			await page.getByRole('dialog', { name: 'Delete 1 photo' }).getByRole('button', { name: /^Move \d+ files? to trash$/ }).click()

			const warning = page.getByRole('dialog', { name: '1 file will be deleted permanently' })
			await expect(warning.getByRole('listitem')).toHaveText([/IMG_0001\.jpg.*Larger than the trash bin allows/])
			await expect(warning.getByRole('button', { name: 'Cancel' })).toBeFocused()
			for (const key of ['Delete', 'Control+Backspace', 'p', 'x']) {
				await page.keyboard.press(key)
			}
			await expect(warning).toBeVisible()
			expect(await exists(page, `${mount}/IMG_0001.jpg`)).toBe(true)
			await warning.getByRole('button', { name: 'Delete permanently' }).click()

			await expect(warning).toBeHidden()
			await expect(page.getByRole('status').filter({ hasText: '1 file deleted permanently' })).toBeVisible()
			await expect(grid.getByRole('gridcell')).toHaveCount(0)
		})
		expect(await exists(page, `${mount}/IMG_0001.jpg`)).toBe(false)
	})
})

// spec: DELETE-002.22, DELETE-002.24
test('cancels the warning on Enter, which acts on the focused Cancel, and reports the file with the warning\'s reason', async ({ page }) => {
	const mount = `External ${randomUUID().slice(0, 8)}`
	await withExternalStorage(mount, async () => {
		await upload(page, `${mount}/IMG_0001.jpg`, JPEG)
		await withSmallTrashBin(async () => {
			await cullFolder(page, mount)
			const grid = page.getByRole('grid', { name: 'Photos' })
			await page.getByRole('button', { name: 'Select', exact: true }).click()
			await grid.getByRole('gridcell', { name: 'IMG_0001, JPG only' }).click()
			await page.getByRole('button', { name: 'Delete…', exact: true }).click()
			await page.getByRole('dialog', { name: 'Delete 1 photo' }).getByRole('button', { name: /^Move \d+ files? to trash$/ }).click()

			const warning = page.getByRole('dialog', { name: '1 file will be deleted permanently' })
			await expect(warning.getByRole('button', { name: 'Cancel' })).toBeFocused()
			await page.keyboard.press('Enter')

			await expect(warning).toBeHidden()
			await expect(page.getByRole('dialog', { name: 'Deletion finished with errors' })).toContainText('Larger than the trash bin allows')
			await expect(grid.getByRole('gridcell')).toHaveCount(1)
		})
		expect(await exists(page, `${mount}/IMG_0001.jpg`)).toBe(true)
	})
})
