// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, listMissingVisualHashes, saveVisualHashes } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const HASHED = { fileId: 3, etag: 'etag-3', hash: '00ff00ff00ff00ff' }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('saveVisualHashes', () => {
	// spec: SERIES-003.12
	it('stores the hashes with the etags they were taken from', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: [3] } })

		await expect(saveVisualHashes([HASHED])).resolves.toEqual([3])

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/visual-hashes', { hashes: [HASHED] })
	})

	// spec: SERIES-004.10
	it('rejects an answer without the saved file ids', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })

		await expect(saveVisualHashes([HASHED])).rejects.toThrow(ApiResponseError)
	})

	// spec: SERIES-003.12
	it('sends nothing for no hashes', async () => {
		await expect(saveVisualHashes([])).resolves.toEqual([])

		expect(axios.put).not.toHaveBeenCalled()
	})
})

describe('listMissingVisualHashes', () => {
	const PAGE = { pictures: [{ fileId: 3, etag: 'etag-3', mtime: 1700000000, path: '/Photos/a.jpg' }], next: 'a.jpg' }

	// spec: SERIES-004.1, SERIES-004.2
	it('asks for the page of the folder after the cursor', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: PAGE })

		await expect(listMissingVisualHashes('/Photos', '2024/b.jpg')).resolves.toEqual(PAGE)

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/visual-hashes/missing', { params: { path: '/Photos', after: '2024/b.jpg' } })
	})

	// spec: SERIES-004.12
	it('rejects an answer that is no page', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { pictures: 'none' } })

		await expect(listMissingVisualHashes('/Photos', '')).rejects.toThrow(ApiResponseError)
	})
})
