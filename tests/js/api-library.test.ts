// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, listLibraryFolders, scanLibrary } from '../../src/api.ts'
import { row } from './logic/folder-fixtures.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const ROW = row({ fileId: 7, root: '/Photos', path: '/Photos/2019' })

describe('listLibraryFolders', () => {
	// spec: FOLDERS-006.6
	it('asks one page of a root after a folder and answers it', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { folders: [ROW], next: 7, scanning: { done: 1, total: 2 } } })

		await expect(listLibraryFolders('/Photos', 3)).resolves.toEqual({ folders: [ROW], next: 7, scanning: { done: 1, total: 2 } })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/library/folders', { params: { root: '/Photos', after: 3 } })
	})

	// spec: FOLDERS-006.4
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
	// spec: FOLDERS-006.7
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
