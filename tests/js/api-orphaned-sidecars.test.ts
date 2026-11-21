// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, listOrphanedSidecars, trashOrphanedSidecars } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const SIDECAR = { fileId: 9, etag: 'etag-9', path: '/Photos/IMG_1.CR2.xmp', size: 4096 }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('listOrphanedSidecars', () => {
	// spec: XMP-009.3
	it('asks for a page of orphaned sidecars below a folder after a cursor', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { sidecars: [SIDECAR], next: '/2024' } })

		await expect(listOrphanedSidecars('/Photos', '/2023')).resolves.toEqual({ sidecars: [SIDECAR], next: '/2024' })

		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/sidecars/orphaned', { params: { path: '/Photos', after: '/2023' } })
	})

	// spec: XMP-009.3
	it('rejects a page without sidecars or cursor', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { sidecars: [{ fileId: 9 }], next: null } })

		await expect(listOrphanedSidecars('/Photos', '')).rejects.toThrow(ApiResponseError)
	})
})

describe('trashOrphanedSidecars', () => {
	// spec: XMP-009.6
	it('sends the file ids and etags and answers each sidecar\'s result', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { sidecars: [{ fileId: 9, result: 'notOrphaned' }] } })

		await expect(trashOrphanedSidecars([{ fileId: 9, etag: 'etag-9' }])).resolves.toEqual([{ fileId: 9, result: 'notOrphaned' }])

		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/sidecars/orphaned/trash', { sidecars: [{ fileId: 9, etag: 'etag-9' }] })
	})

	// spec: XMP-009.6
	it('rejects an answer without a result for each sidecar', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { sidecars: [] } })

		await expect(trashOrphanedSidecars([{ fileId: 9, etag: 'etag-9' }])).rejects.toThrow(ApiResponseError)
	})
})
