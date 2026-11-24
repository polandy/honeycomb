// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpCacheRow } from '../../src/logic/xmp-cache.ts'

import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError } from '../../src/api/index.ts'
import { clearCache, lookupXmpCache, saveXmpCache } from '../../src/sidecars/xmp-cache-api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { delete: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('clearCache', () => {
	// spec: SETTINGS-001.25
	it('deletes the user\'s XMP cache and visual hashes', async () => {
		vi.mocked(axios.delete).mockResolvedValue({ status: 204 })

		await expect(clearCache()).resolves.toBeUndefined()

		expect(axios.delete).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/xmp-cache')
	})

	// spec: SETTINGS-001.25
	it('passes a failure on', async () => {
		vi.mocked(axios.delete).mockRejectedValue(new Error('offline'))

		await expect(clearCache()).rejects.toThrow('offline')
	})
})

const ROW: XmpCacheRow = { fileId: 11, kind: 'sidecar', etag: 'e', reader: 1, state: 'read', reason: null, rating: 4, flag: null, colourLabel: null, keepRaw: null, tags: ['Trip'] }

describe('lookupXmpCache', () => {
	// spec: XMP-006.1, XMP-006.7
	it('reads the rows of the files', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { entries: [ROW] } })

		expect(await lookupXmpCache([11, 12])).toEqual([ROW])
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/xmp-cache/lookup', { fileIds: [11, 12] })
	})

	// spec: XMP-006.7
	it('asks nothing for no files and rejects a response without entries', async () => {
		expect(await lookupXmpCache([])).toEqual([])
		expect(axios.post).not.toHaveBeenCalled()

		vi.mocked(axios.post).mockResolvedValue({ data: { rows: [] } })
		await expect(lookupXmpCache([11])).rejects.toBeInstanceOf(ApiResponseError)
	})
})

describe('saveXmpCache', () => {
	// spec: XMP-006.2, XMP-006.7
	it('stores the rows and sends nothing for none', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: [11] } })

		await saveXmpCache([ROW])
		await saveXmpCache([])

		expect(axios.put).toHaveBeenCalledOnce()
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/xmp-cache', { entries: [ROW] })
	})
})
