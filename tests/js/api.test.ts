// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, imageUrl, listEntries, listFolders, warmPreviews } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({
	generateUrl: (url: string, params: Record<string, number> = {}) => `/index.php${url.replace(/\{(\w+)\}/g, (_, key: string) => String(params[key]))}`,
}))

const ENTRY = {
	fileId: 7,
	path: '/P/A.JPG',
	size: 10,
	mtime: 1234,
	etag: 'e',
	mime: 'image/jpeg',
	captureTime: null,
	orientation: 1,
	width: 6000,
	height: 4000,
}

describe('listEntries', () => {
	it('lists a folder with its subfolders', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [ENTRY], truncated: true } })

		const listing = await listEntries('/Photos', true)

		expect(listing).toEqual({ entries: [ENTRY], truncated: true })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '/Photos', subfolders: 1 } })
	})

	it('lists a folder alone without the subfolders parameter', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [], truncated: false } })

		await listEntries('', false)

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '' } })
	})

	it.each([
		['no object', 'oops'],
		['no entries', { truncated: false }],
		['no truncated flag', { entries: [] }],
	])('rejects a response with %s', async (_case, data) => {
		vi.mocked(axios.get).mockResolvedValue({ data })

		await expect(listEntries('', false)).rejects.toThrow(ApiResponseError)
	})
})

describe('listFolders', () => {
	it('lists the child folders of a folder', async () => {
		const folders = [{ name: 'A', path: '/P/A', hasSubfolders: false }]
		vi.mocked(axios.get).mockResolvedValue({ data: { folders } })

		expect(await listFolders('/P')).toEqual(folders)
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/folders', { params: { path: '/P' } })
	})

	it('rejects a response without folders', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [] } })

		await expect(listFolders('')).rejects.toThrow(ApiResponseError)
	})
})

describe('warmPreviews', () => {
	it('asks the server to render the previews of the files', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: null })

		await warmPreviews([3, 1, 2])

		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/previews', { fileIds: [3, 1, 2] })
	})

	it('sends nothing for no files', async () => {
		await warmPreviews([])

		expect(axios.post).not.toHaveBeenCalled()
	})
})

describe('imageUrl', () => {
	it('names the file, the tier and the modification time', () => {
		expect(imageUrl(7, 256, 1234)).toBe('/index.php/apps/honeycomb/api/v1/images/7?size=256&v=1234')
	})
})
