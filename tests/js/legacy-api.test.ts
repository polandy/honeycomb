// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError } from '../../src/api.ts'
import { acknowledgeLegacy, loadLegacyExport, loadLegacyInventory } from '../../src/legacy-api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), delete: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('loadLegacyInventory', () => {
	// spec: XMP-007.1
	it('reads the folders with legacy rows and the unreachable count', async () => {
		const inventory = { folders: [{ path: '/Photos/A', files: 2 }], unreachable: 1 }
		vi.mocked(axios.get).mockResolvedValue({ data: inventory })

		await expect(loadLegacyInventory()).resolves.toEqual(inventory)
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/legacy/folders')
	})

	// spec: XMP-007.1
	it.each([['no object', 'oops'], ['no folders array', { folders: {}, unreachable: 0 }], ['no unreachable count', { folders: [] }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.get).mockResolvedValue({ data })

		await expect(loadLegacyInventory()).rejects.toThrow(ApiResponseError)
	})
})

describe('loadLegacyExport', () => {
	// spec: XMP-007.2
	it('reads the rows of the unreachable file ids', async () => {
		const exported = { decisions: [{ fileId: 7, rating: 1, colourLabel: null, flag: 'picked', keepRaw: false }], tags: [{ fileId: 8, tags: ['Anna'] }] }
		vi.mocked(axios.get).mockResolvedValue({ data: exported })

		await expect(loadLegacyExport()).resolves.toEqual(exported)
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/legacy/export')
	})

	// spec: XMP-007.2
	it.each([['no object', 'oops'], ['no decisions array', { decisions: {}, tags: [] }], ['no tags array', { decisions: [] }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.get).mockResolvedValue({ data })

		await expect(loadLegacyExport()).rejects.toThrow(ApiResponseError)
	})
})

describe('acknowledgeLegacy', () => {
	// spec: XMP-007.3
	it('removes the legacy rows of the file ids, and asks nothing for none', async () => {
		vi.mocked(axios.delete).mockResolvedValue({ data: '' })

		await acknowledgeLegacy([])
		expect(axios.delete).not.toHaveBeenCalled()
		await acknowledgeLegacy([3, 4])
		expect(axios.delete).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/legacy', { data: { fileIds: [3, 4] } })
	})
})
