// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, loadPositions, savePosition } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const POSITION = { folderSet: { paths: ['/Trip'], subfolders: true }, fileId: 4, decided: 1, total: 3 }

describe('loadPositions', () => {
	// spec: DECISIONS-002.7
	it('answers the stored positions as they came', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { positions: [{ ...POSITION, updatedAt: 5 }] } })

		await expect(loadPositions()).resolves.toEqual([{ ...POSITION, updatedAt: 5 }])
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/positions')
	})

	it('refuses an answer without a positions array', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { positions: {} } })
		await expect(loadPositions()).rejects.toThrow(ApiResponseError)

		vi.mocked(axios.get).mockResolvedValue({ data: null })
		await expect(loadPositions()).rejects.toThrow(ApiResponseError)
	})
})

describe('savePosition', () => {
	// spec: DECISIONS-002.7
	it('stores the position of the folder set', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })

		await savePosition(POSITION)

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/positions', POSITION)
	})
})
