// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderPictureApi } from '../../src/cull/folder-picture-source.ts'

import { describe, expect, it, vi } from 'vitest'
import { folderPictureSource } from '../../src/cull/folder-picture-source.ts'
import { EVERYTHING } from '../../src/logic/opened-source.ts'
import { DEFAULT_SETTINGS, pairingSettings } from '../../src/logic/settings.ts'
import { listingEntry } from './logic/listing-entries.ts'

const PAIR = [listingEntry(1, '/P/a.jpg'), listingEntry(2, '/P/a.dng')]
const SINGLE = listingEntry(3, '/Q/b.jpg', { mtime: 1234 })

/** A fake server that lists /P with the pair and /Q with the single, and saves every flag but those of file 2. */
function serverApi() {
	return {
		listEntries: vi.fn<FolderPictureApi['listEntries']>(async (path) => ({ entries: path === '/P' ? PAIR : [SINGLE], truncated: false })),
		imageUrl: vi.fn<FolderPictureApi['imageUrl']>((fileId, size, mtime) => `${fileId}/${size}?v=${mtime}`),
		saveFlags: vi.fn<FolderPictureApi['saveFlags']>(async (items) => ({ saved: items.map(({ fileId }) => fileId).filter((fileId) => fileId !== 2), skipped: [{ fileId: 2, reason: 'locked' }] })),
	}
}

describe('folderPictureSource', () => {
	it('allows everything', () => {
		expect(folderPictureSource(serverApi()).capabilities).toBe(EVERYTHING)
	})

	it('lists every ticked folder of the set as one page, the excluded folders left out', async () => {
		const api = serverApi()

		const page = await folderPictureSource(api).list({ paths: ['/P', '/Q'], subfolders: true, excluded: ['/P/old'] }, null)

		expect(api.listEntries.mock.calls).toEqual([['/P', true, ['/P/old']], ['/Q', true, []]])
		expect(page).toEqual({ listings: [{ entries: PAIR, truncated: false }, { entries: [SINGLE], truncated: false }], nextCursor: null })
	})

	it('fails the listing when a folder cannot be listed', async () => {
		const api = serverApi()
		api.listEntries.mockRejectedValueOnce(new Error('folder gone'))

		await expect(folderPictureSource(api).list({ paths: ['/P'], subfolders: false }, null)).rejects.toThrow('folder gone')
	})

	it('counts the pictures of the listed page client side as the pairing pairs them', async () => {
		const source = folderPictureSource(serverApi())
		const { listings } = await source.list({ paths: ['/P', '/Q'], subfolders: false }, null)

		const counts = await source.counts({ listings, pairing: pairingSettings(DEFAULT_SETTINGS) })

		expect(counts).toMatchObject({ pictures: 2, folders: 2, firstFolder: '/P' })
		expect(counts.entries.map(({ fileId }) => fileId)).toEqual([1, 2, 3])
	})

	it('names an entry\'s image by its file id, the size and its modification time', () => {
		expect(folderPictureSource(serverApi()).imageUrl(SINGLE, 1024)).toBe('3/1024?v=1234')
	})

	it('saves the flag rows and answers what the server skipped', async () => {
		const api = serverApi()
		const rows = [{ fileId: 1, flag: 'picked', keepRaw: false }, { fileId: 2, flag: 'picked', keepRaw: false }] as const

		const answer = await folderPictureSource(api).decide(rows)

		expect(api.saveFlags).toHaveBeenCalledExactlyOnceWith(rows)
		expect(answer.skipped).toEqual([{ fileId: 2, reason: 'locked' }])
	})

	it('fails the save when the server does', async () => {
		const api = serverApi()
		api.saveFlags.mockRejectedValueOnce(new Error('database down'))

		await expect(folderPictureSource(api).decide([{ fileId: 1, flag: 'rejected', keepRaw: false }])).rejects.toThrow('database down')
	})
})
