// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, imageUrl, listEntries, listFolders, loadSettings, lookupEmbeddedXmp, lookupSidecars, saveSettings, saveSidecars, TrashBinOffError, trashPictures } from '../../src/api.ts'

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

		expect(listing).toEqual({ entries: [ENTRY], truncated: true, folders: [] })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '/Photos', subfolders: 1 } })
	})

	// spec: LISTING-001.1
	it('lists a folder alone without the subfolders parameter', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [], truncated: false } })

		await listEntries('', false)

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/entries', { params: { path: '' } })
	})

	// spec: LISTING-001.19, XMP-008.12
	it('returns the folders with their path and permissions', async () => {
		const folders = [{ path: '/Photos/Team', permissions: 1 }, { path: '/Photos', permissions: 31 }]
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [ENTRY], truncated: false, folders, fileId: 7 } })

		const listing = await listEntries('/Photos', true)

		expect(listing).toEqual({ entries: [ENTRY], truncated: false, folders })
	})

	// spec: XMP-008.12
	it('drops a folder item of the wrong shape and keeps only path and permissions', async () => {
		const folders = [{ path: '/Photos' }, 'oops', { path: '/Photos/A', shared: false, permissions: 31, versions: true }]
		vi.mocked(axios.get).mockResolvedValue({ data: { entries: [], truncated: false, folders } })

		const listing = await listEntries('/Photos', true)

		expect(listing.folders).toEqual([{ path: '/Photos/A', permissions: 31 }])
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
		const folders = [{ name: 'A', path: '/P/A', hasSubfolders: false, photoFiles: 0, photoFilesBelow: 0, photoFilesBelowApproximate: false }]
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

/** The bytes of a text, as a sidecar holds them. */
const bytesOf = (text: string) => new TextEncoder().encode(text)

describe('lookupSidecars', () => {
	// spec: XMP-003.34
	it('decodes the bytes of each read sidecar and keeps the other results', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { sidecars: [
			{ fileId: 9, result: 'read', content: btoa('<x/>'), etag: 'e', size: 4, mtime: 17 },
			{ fileId: 10, result: 'locked' },
		] } })

		const answers = await lookupSidecars([9, 10])

		expect(answers).toEqual([{ result: 'read', bytes: bytesOf('<x/>'), etag: 'e', size: 4, mtime: 17 }, { result: 'locked' }])
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/sidecars/lookup', { fileIds: [9, 10] })
	})

	it('asks in requests of at most 1,000 ids and asks nothing for none', async () => {
		vi.mocked(axios.post).mockImplementation(async (_url, body) => ({ data: { sidecars: (body as { fileIds: number[] }).fileIds.map(() => ({ result: 'notFound' })) } }))
		const ids = Array.from({ length: 1001 }, (_, index) => index)

		expect(await lookupSidecars(ids)).toHaveLength(1001)
		expect(vi.mocked(axios.post).mock.calls.map(([, body]) => (body as { fileIds: number[] }).fileIds.length)).toEqual([1000, 1])
		vi.mocked(axios.post).mockClear()
		expect(await lookupSidecars([])).toEqual([])
		expect(axios.post).not.toHaveBeenCalled()
	})

	// spec: XMP-003.32
	it('packs the ids by the listed sizes into requests of at most 8 MiB, an id without a size counting nothing', async () => {
		vi.mocked(axios.post).mockImplementation(async (_url, body) => ({ data: { sidecars: (body as { fileIds: number[] }).fileIds.map(() => ({ result: 'notFound' })) } }))
		const sizes = new Map([[1, 5 * 1024 * 1024], [2, 4 * 1024 * 1024]])

		expect(await lookupSidecars([1, 2, 3], sizes)).toHaveLength(3)
		expect(vi.mocked(axios.post).mock.calls.map(([, body]) => (body as { fileIds: number[] }).fileIds)).toEqual([[1], [2, 3]])
	})

	it.each([
		['no sidecars array', {}],
		['another number of answers', { sidecars: [] }],
	])('rejects a response with %s', async (_case, data) => {
		vi.mocked(axios.post).mockResolvedValue({ data })

		await expect(lookupSidecars([1])).rejects.toThrow(ApiResponseError)
	})
})

describe('lookupEmbeddedXmp', () => {
	// spec: TAGS-002.15
	it('decodes each packet read, keeps the other results and rejects a response of another shape', async () => {
		vi.mocked(axios.post).mockResolvedValueOnce({ data: { packets: [{ fileId: 9, result: 'read', content: btoa('<x/>') }, { fileId: 10, result: 'none' }] } })
		vi.mocked(axios.post).mockResolvedValueOnce({ data: { sidecars: [{ result: 'none' }] } })

		expect(await lookupEmbeddedXmp([9, 10])).toEqual([{ result: 'read', bytes: bytesOf('<x/>') }, { result: 'none' }])
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/embedded-xmp/lookup', { fileIds: [9, 10] })
		await expect(lookupEmbeddedXmp([1])).rejects.toThrow(ApiResponseError)
	})
})

describe('saveSidecars', () => {
	// spec: XMP-003.7
	it('sends existing sidecars with ETag and size and new ones by path, in base64', async () => {
		const large = new Uint8Array(70000).map((_, index) => index % 256)
		vi.mocked(axios.put).mockResolvedValue({ data: { sidecars: [{ result: 'saved', fileId: 9, etag: 'n', size: 3, mtime: 5 }, { result: 'changed' }] } })

		const answers = await saveSidecars([{ fileId: 9, etag: 'e', size: 2, bytes: bytesOf('ab\u00e9') }, { path: '/P/A.JPG.xmp', bytes: large }])

		expect(answers).toEqual([{ result: 'saved', fileId: 9, etag: 'n', size: 3, mtime: 5 }, { result: 'changed' }])
		const [url, body] = vi.mocked(axios.put).mock.calls[0]!
		const [existing, created] = (body as { sidecars: Record<string, unknown>[] }).sidecars
		expect(url).toBe('/index.php/apps/honeycomb/api/v1/sidecars')
		expect(existing).toEqual({ fileId: 9, etag: 'e', size: 2, content: 'YWLDqQ==' })
		expect(created!.path).toBe('/P/A.JPG.xmp')
		expect(Uint8Array.from(atob(created!.content as string), (char) => char.charCodeAt(0))).toEqual(large)
	})

	it('saves in requests of at most 1,000 sidecars and rejects a short answer', async () => {
		vi.mocked(axios.put).mockImplementation(async (_url, body) => ({ data: { sidecars: (body as { sidecars: unknown[] }).sidecars.map(() => ({ result: 'failed' })) } }))
		const items = Array.from({ length: 1001 }, (_, index) => ({ path: `/P/${index}.xmp`, bytes: new Uint8Array() }))

		expect(await saveSidecars(items)).toHaveLength(1001)
		expect(await saveSidecars([])).toEqual([])
		expect(axios.put).toHaveBeenCalledTimes(2)
		vi.mocked(axios.put).mockResolvedValue({ data: { sidecars: [] } })
		await expect(saveSidecars(items.slice(0, 1))).rejects.toThrow(ApiResponseError)
	})

	// spec: XMP-003.32
	it('packs the sidecars by their content into requests of at most 8 MiB', async () => {
		vi.mocked(axios.put).mockImplementation(async (_url, body) => ({ data: { sidecars: (body as { sidecars: unknown[] }).sidecars.map(() => ({ result: 'failed' })) } }))
		const items = [5, 4, 3].map((mebibytes, index) => ({ path: `/P/${index}.xmp`, bytes: new Uint8Array(mebibytes * 1024 * 1024) }))

		expect(await saveSidecars(items)).toHaveLength(3)
		expect(vi.mocked(axios.put).mock.calls.map(([, body]) => (body as { sidecars: { path: string }[] }).sidecars.map(({ path }) => path))).toEqual([['/P/0.xmp'], ['/P/1.xmp', '/P/2.xmp']])
	})
})
