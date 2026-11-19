// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, cleanUpOrphanedData, resetStatistics } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { delete: vi.fn(), get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

beforeEach(() => {
	vi.clearAllMocks()
})

describe('cleanUpOrphanedData', () => {
	// spec: SETTINGS-001.27
	it('asks the server to clean up and answers how many rows went', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: { removed: 12 } })

		await expect(cleanUpOrphanedData()).resolves.toBe(12)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/cleanup')
	})

	// spec: SETTINGS-001.27
	it.each([['no object', null], ['no count', { removed: '12' }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.post).mockResolvedValue({ data })

		await expect(cleanUpOrphanedData()).rejects.toThrow(ApiResponseError)
	})
})

describe('resetStatistics', () => {
	// spec: STATS-001.3
	it('asks the server to delete the user\'s statistics', async () => {
		vi.mocked(axios.delete).mockResolvedValue({ status: 204 })

		await resetStatistics()

		expect(axios.delete).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/stats')
	})
})
