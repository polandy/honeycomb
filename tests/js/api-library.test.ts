// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, listLibraryFolders, markFolderDone, reopenFolder, scanLibrary } from '../../src/api.ts'
import { row } from './logic/folder-fixtures.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const ROW = row({ fileId: 7, root: '/Photos', path: '/Photos/2019' })

describe('listLibraryFolders', () => {
	// spec: FOLDERS-007.6
	it('asks one page of a root after a folder and answers it', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [ROW], next: 7, scanning: { done: 1, total: 2 } } })

		await expect(listLibraryFolders('/Photos', 3)).resolves.toEqual({ folders: [ROW], next: 7, scanning: { done: 1, total: 2 } })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders', { params: { root: '/Photos', after: 3 } })
	})

	// spec: FOLDERS-007.4
	it('asks a page of the given size', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [], next: null, scanning: null } })

		await expect(listLibraryFolders('/Photos', 0, 1)).resolves.toEqual({ folders: [], next: null, scanning: null })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders', { params: { root: '/Photos', after: 0, limit: 1 } })
	})

	it('refuses a page of the wrong shape', async () => {
		for (const data of [null, { folders: {}, next: null, scanning: null }, { folders: [{ fileId: '7' }], next: null, scanning: null }, { folders: [], next: '7', scanning: null }, { folders: [], next: null, scanning: { done: 1 } }]) {
			vi.mocked(axios.get).mockResolvedValue({ data })
			await expect(listLibraryFolders('/Photos')).rejects.toThrow(ApiResponseError)
		}
	})
})

describe('scanLibrary', () => {
	// spec: FOLDERS-007.7
	it('summarises the next batch of a root and answers how far it is', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { scanning: { done: 9, total: 12 } } })

		await expect(scanLibrary('/Photos')).resolves.toEqual({ done: 9, total: 12 })
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/scan', { root: '/Photos' })
	})

	it('refuses an answer without its progress', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { scanning: null } })
		await expect(scanLibrary('/Photos')).rejects.toThrow(ApiResponseError)
	})
})

describe('markFolderDone', () => {
	// spec: FOLDERS-008.1
	it('marks the folder done as of its photos and answers the done status', async () => {
		const done = { by: 'andy', at: 1_800_000_000, photos: 412 }
		vi.mocked(axios.put).mockResolvedValue({ data: { fileId: 7, done } })

		await expect(markFolderDone(7, 412)).resolves.toEqual(done)
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders/7/done', { photos: 412 })
	})

	it('refuses an answer without its done status', async () => {
		for (const data of [null, { fileId: 7, done: null }, { fileId: 7, done: { by: 'andy', at: '1', photos: 412 } }]) {
			vi.mocked(axios.put).mockResolvedValue({ data })
			await expect(markFolderDone(7, 412)).rejects.toThrow(ApiResponseError)
		}
	})
})

describe('reopenFolder', () => {
	// spec: FOLDERS-008.4
	it('removes the done status of the folder', async () => {
		vi.mocked(axios.delete).mockResolvedValue({ data: '' })

		await expect(reopenFolder(7)).resolves.toBeUndefined()
		expect(axios.delete).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders/7/done')
	})
})
