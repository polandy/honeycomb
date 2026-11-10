// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, imageUrl, listEntries, listFolders, loadSettings, lookupDecisions, saveDecisions, saveSettings, TrashBinOffError, trashPictures, warmPreviews } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
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
	// spec: LISTING-001.4
	it('lists a folder with its subfolders', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [ENTRY], truncated: true } })

		const listing = await listEntries('/Photos', true)

		expect(listing).toEqual({ entries: [ENTRY], truncated: true })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '/Photos', subfolders: 1 } })
	})

	// spec: LISTING-001.1
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
	// spec: LISTING-003.1
	it('lists the child folders of a folder', async () => {
		const folders = [{ name: 'A', path: '/P/A', hasSubfolders: false }]
		vi.mocked(axios.get).mockResolvedValue({ data: { folders } })

		expect(await listFolders('/P')).toEqual(folders)
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/folders', { params: { path: '/P' } })
	})

	// spec: LISTING-003.10
	it('rejects a response without folders', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [] } })

		await expect(listFolders('')).rejects.toThrow(ApiResponseError)
	})
})

describe('warmPreviews', () => {
	// spec: IMAGES-001.10
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

describe('lookupDecisions', () => {
	// spec: DECISIONS-001.1
	it('reads the stored decisions of the files', async () => {
		const decisions = [{ fileId: 3, rating: 4, colourLabel: 'green', flag: 'picked', keepRaw: true }]
		vi.mocked(axios.post).mockResolvedValue({ data: { decisions } })

		expect(await lookupDecisions([3, 1])).toEqual(decisions)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/decisions/lookup', { fileIds: [3, 1] })
	})

	// spec: DECISIONS-001.10
	it('asks nothing for no files', async () => {
		expect(await lookupDecisions([])).toEqual([])
		expect(axios.post).not.toHaveBeenCalled()
	})

	// spec: DECISIONS-001.9
	it.each([['no object', 'oops'], ['no decisions', { rows: [] }]])('rejects a response with %s', async (_case, data) => {
		vi.mocked(axios.post).mockResolvedValue({ data })

		await expect(lookupDecisions([1])).rejects.toThrow(ApiResponseError)
	})
})

describe('saveDecisions', () => {
	// spec: DECISIONS-001.2
	it('stores the whole decisions of the files', async () => {
		const decisions = [{ fileId: 3, rating: 4, colourLabel: null, flag: 'picked' as const, keepRaw: false }]
		vi.mocked(axios.put).mockResolvedValue({ status: 204 })

		await saveDecisions(decisions)

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/decisions', { decisions })
	})

	// spec: DECISIONS-001.10
	it('sends nothing for no decisions', async () => {
		await saveDecisions([])

		expect(axios.put).not.toHaveBeenCalled()
	})
})

describe('loadSettings', () => {
	it('answers the stored settings as they came', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { settings: { viKeys: true } } })

		await expect(loadSettings()).resolves.toEqual({ viKeys: true })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/settings')
	})

	it('refuses an answer that is no object', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: 'settings' })

		await expect(loadSettings()).rejects.toThrow(ApiResponseError)
	})
})

describe('saveSettings', () => {
	it('stores the whole settings', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })

		await saveSettings({ viKeys: true })

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/settings', { settings: { viKeys: true } })
	})
})

describe('imageUrl', () => {
	// spec: IMAGES-001.1
	it('names the file, the tier and the modification time', () => {
		expect(imageUrl(7, 256, 1234)).toBe('/index.php/apps/honeycomb/api/v1/images/7?size=256&v=1234')
	})
})

describe('trashPictures', () => {
	const pictures = [[{ fileId: 7, etag: 'e7' }, { fileId: 8, etag: 'e8' }]]

	it('sends the pictures and returns the result of each file', async () => {
		const results = [[{ fileId: 7, result: 'trashed' }, { fileId: 8, result: 'locked' }]]
		vi.mocked(axios.post).mockResolvedValue({ data: { pictures: results } })

		expect(await trashPictures(pictures)).toEqual(results)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/trash', { pictures })
	})

	it('refuses a response without a pictures array', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: {} })

		await expect(trashPictures(pictures)).rejects.toBeInstanceOf(ApiResponseError)
	})

	it('turns a 409 into its own error, since the trash bin is off and nothing was touched', async () => {
		vi.mocked(axios.post).mockRejectedValue(Object.assign(new Error('Conflict'), { response: { status: 409 } }))

		await expect(trashPictures(pictures)).rejects.toBeInstanceOf(TrashBinOffError)
	})

	it.each([new Error('Network Error'), Object.assign(new Error('Bad'), { response: { status: 400 } })])('passes any other error on', async (error) => {
		vi.mocked(axios.post).mockRejectedValue(error)

		await expect(trashPictures(pictures)).rejects.toBe(error)
	})
})
