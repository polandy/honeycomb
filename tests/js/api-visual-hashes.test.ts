// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { saveVisualHashes } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const HASHED = { fileId: 3, etag: 'etag-3', hash: '00ff00ff00ff00ff' }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('saveVisualHashes', () => {
	// spec: SERIES-003.12
	it('stores the hashes with the etags they were taken from', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: [3] } })

		await saveVisualHashes([HASHED])

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/visual-hashes', { hashes: [HASHED] })
	})

	// spec: SERIES-003.12
	it('sends nothing for no hashes', async () => {
		await saveVisualHashes([])

		expect(axios.put).not.toHaveBeenCalled()
	})
})
