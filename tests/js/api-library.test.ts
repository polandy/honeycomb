// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, listAllLibraryFolders, listLibraryFolders, markFolderDone, markFoldersDone, reopenFolder, reopenFolders, scanLibrary } from '../../src/api/index.ts'
import { row } from './logic/folder-fixtures.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const ROW = row({ fileId: 7, root: '/Photos', path: '/Photos/2019' })

describe('listLibraryFolders', () => {
	// spec: FOLDERS-007.6
	it('asks one page of a root after a folder and answers it', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [ROW], nextCursor: 7, scanning: { done: 1, total: 2 } } })

		await expect(listLibraryFolders('/Photos', 3)).resolves.toEqual({ folders: [ROW], nextCursor: 7, scanning: { done: 1, total: 2 } })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders', { params: { root: '/Photos', cursor: 3 } })
	})

	// spec: FOLDERS-007.18
	it('keeps a row\'s previews', async () => {
		const previewed = row({ fileId: 8, previews: [{ fileId: 3, mtime: 9 }] })
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [previewed], nextCursor: null, scanning: null } })

		await expect(listLibraryFolders('/Photos')).resolves.toMatchObject({ folders: [{ previews: [{ fileId: 3, mtime: 9 }] }] })
	})

	// spec: FOLDERS-007.4
	it('asks a page of the given size', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [], nextCursor: null, scanning: null } })

		await expect(listLibraryFolders('/Photos', 0, 1)).resolves.toEqual({ folders: [], nextCursor: null, scanning: null })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders', { params: { root: '/Photos', cursor: 0, limit: 1 } })
	})

	it('refuses a page of the wrong shape', async () => {
		for (const data of [null, { folders: {}, nextCursor: null, scanning: null }, { folders: [{ fileId: '7' }], nextCursor: null, scanning: null }, { folders: [{ ...ROW, previews: undefined }], nextCursor: null, scanning: null }, { folders: [{ ...ROW, previews: [{ fileId: 1 }] }], nextCursor: null, scanning: null }, { folders: [], nextCursor: '7', scanning: null }, { folders: [], nextCursor: null, scanning: { done: 1 } }]) {
			vi.mocked(axios.get).mockResolvedValue({ data })
			await expect(listLibraryFolders('/Photos')).rejects.toThrow(ApiResponseError)
		}
	})
})

describe('listAllLibraryFolders', () => {
	// spec: STATS-001.42
	it('reads every page of a root', async () => {
		const other = row({ fileId: 8, path: '/Photos/2020' })
		vi.mocked(axios.get)
			.mockResolvedValueOnce({ data: { folders: [ROW], nextCursor: 7, scanning: null } })
			.mockResolvedValueOnce({ data: { folders: [other], nextCursor: null, scanning: null } })

		await expect(listAllLibraryFolders('/Photos')).resolves.toEqual([ROW, other])
		expect(vi.mocked(axios.get).mock.calls.slice(-2).map(([, config]) => config)).toEqual([{ params: { root: '/Photos', cursor: 0 } }, { params: { root: '/Photos', cursor: 7 } }])
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
	// spec: FOLDERS-006.14
	it('accepts a done status whose user was deleted', async () => {
		const done = { by: null, at: 1_800_000_000, photos: 412 }
		vi.mocked(axios.put).mockResolvedValue({ data: { fileId: 7, done } })

		await expect(markFolderDone(7, 412)).resolves.toEqual(done)
	})

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

describe('markFoldersDone', () => {
	const DONE = { by: 'andy', at: 1_800_000_000, photos: 412 }

	// spec: FOLDERS-009.11
	it('marks the folders in one call and answers the written and the skipped ones', async () => {
		const batch = { done: [{ fileId: 7, done: DONE }], skipped: [{ fileId: 8, reason: 'read-only' }, { fileId: 9, reason: 'done' }] }
		vi.mocked(axios.put).mockReset().mockResolvedValue({ data: batch })

		await expect(markFoldersDone([{ fileId: 7, photos: 412 }, { fileId: 8, photos: 3 }, { fileId: 9, photos: 1 }])).resolves.toEqual(batch)
		expect(axios.put).toHaveBeenCalledOnce()
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/done', { folders: [{ fileId: 7, photos: 412 }, { fileId: 8, photos: 3 }, { fileId: 9, photos: 1 }] })
	})

	// spec: FOLDERS-006.16
	it('sends more than 500 folders in calls of 500 and joins the answers', async () => {
		const folders = Array.from({ length: 501 }, (_, index) => ({ fileId: index + 1, photos: 1 }))
		vi.mocked(axios.put).mockReset()
			.mockResolvedValueOnce({ data: { done: [{ fileId: 1, done: DONE }], skipped: [] } })
			.mockResolvedValueOnce({ data: { done: [], skipped: [{ fileId: 501, reason: 'done' }] } })

		await expect(markFoldersDone(folders)).resolves.toEqual({ done: [{ fileId: 1, done: DONE }], skipped: [{ fileId: 501, reason: 'done' }] })
		expect(vi.mocked(axios.put).mock.calls.map((call) => (call[1] as { folders: unknown[] }).folders.length)).toEqual([500, 1])
	})

	it('refuses an answer of the wrong shape', async () => {
		for (const data of [null, { done: [] }, { done: [{ fileId: 7, done: null }], skipped: [] }, { done: [], skipped: [{ fileId: 7, reason: 'gone' }] }, { done: [], skipped: [{ fileId: '7', reason: 'done' }] }]) {
			vi.mocked(axios.put).mockReset().mockResolvedValue({ data })
			await expect(markFoldersDone([{ fileId: 7, photos: 1 }])).rejects.toThrow(ApiResponseError)
		}
	})
})

describe('reopenFolders', () => {
	// spec: FOLDERS-009.13
	it('removes the done status of the folders in one call, more than 500 in calls of 500', async () => {
		vi.mocked(axios.delete).mockReset().mockResolvedValue({ data: '' })

		await expect(reopenFolders([7, 8])).resolves.toBeUndefined()
		await reopenFolders(Array.from({ length: 501 }, (_, index) => index + 1))

		expect(axios.delete).toHaveBeenNthCalledWith(1, '/index.php/apps/honeycomb/api/v1/library/done', { data: { fileIds: [7, 8] } })
		expect(vi.mocked(axios.delete).mock.calls.slice(1).map((call) => (call[1] as { data: { fileIds: number[] } }).data.fileIds.length)).toEqual([500, 1])
	})
})
