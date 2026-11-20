// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError, saveQualityValues } from '../../src/api.ts'
import { RateLimitedError } from '../../src/logic/retry-after.ts'

vi.mock('@nextcloud/axios', () => ({ default: { put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const MEASURED = { fileId: 3, etag: 'etag-3', method: 1, sharpness: 812.4, focusTile: 27 }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('saveQualityValues', () => {
	// spec: SERIES-006.7
	it('stores the values with the etags they were taken from', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: [3] } })

		await expect(saveQualityValues([MEASURED])).resolves.toEqual([3])

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/quality-values', { values: [MEASURED] })
	})

	it('sends nothing for no values', async () => {
		await expect(saveQualityValues([])).resolves.toEqual([])

		expect(axios.put).not.toHaveBeenCalled()
	})

	it('rejects an answer without the saved file ids', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { saved: ['3'] } })

		await expect(saveQualityValues([MEASURED])).rejects.toThrow(ApiResponseError)
	})

	// spec: SERIES-006.18
	it('tells a limited save by the seconds the server asks to wait', async () => {
		vi.mocked(axios.put).mockRejectedValue({ response: { status: 429, headers: { 'retry-after': '30' } } })

		const error: unknown = await saveQualityValues([MEASURED]).catch((failure: unknown) => failure)

		expect(error).toBeInstanceOf(RateLimitedError)
		expect(error).toMatchObject({ seconds: 30 })
	})
})
