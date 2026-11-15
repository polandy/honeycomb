// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { clearCache } from '../../src/xmp-cache-api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { delete: vi.fn() } }))
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
