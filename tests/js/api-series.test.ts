// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiResponseError } from '../../src/api/index.ts'
import { lookupSeries, saveSeries } from '../../src/series/series-api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

const ANSWER = { series: [{ id: 12, status: 'open', fileIds: [3, 4], elsewhere: true }], keptOut: [5] }

beforeEach(() => {
	vi.clearAllMocks()
})

describe('lookupSeries', () => {
	// spec: SERIES-005.20
	it('reads the stored series and kept-out files among the files', async () => {
		vi.mocked(axios.post).mockResolvedValue({ data: ANSWER })

		await expect(lookupSeries([3, 4, 5])).resolves.toEqual(ANSWER)
		expect(axios.post).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/series/lookup', { fileIds: [3, 4, 5] })
	})

	// spec: SERIES-005.20
	it('asks nothing for no file ids', async () => {
		await expect(lookupSeries([])).resolves.toEqual({ series: [], keptOut: [] })
		expect(axios.post).not.toHaveBeenCalled()
	})

	// spec: SERIES-005.20
	it.each([['no object', 'oops'], ['no series array', { series: {}, keptOut: [] }], ['no keptOut array', { series: [] }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.post).mockResolvedValue({ data })

		await expect(lookupSeries([1])).rejects.toThrow(ApiResponseError)
	})
})

const WRITE = { series: [{ id: null, status: 'open', fileIds: [3, 4] }], keptOut: [5], released: [] } as const

describe('saveSeries', () => {
	// spec: SERIES-005.21, SERIES-005.22
	it('writes the series and answers their ids in request order', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: { ids: [31], saved: [3, 4, 5] } })

		await expect(saveSeries(WRITE)).resolves.toEqual({ ids: [31] })
		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/series', WRITE)
	})

	// spec: SERIES-005.21
	it.each([['no object', 'oops'], ['no ids array', { ids: {} }]])('rejects an answer with %s', async (_case, data) => {
		vi.mocked(axios.put).mockResolvedValue({ data })

		await expect(saveSeries(WRITE)).rejects.toThrow(ApiResponseError)
	})
})
