// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SeriesLookup } from '../../src/logic/stored-series.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { useStoredSeries } from '../../src/stored-series.ts'
import { ENTRIES } from './app-cull.ts'
import { picturesOf } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

const OPEN = { status: 'open', elsewhere: false } as const

/** Stored series over a lookup that answers `answer`, or fails with it, for the cull `cull.at`. */
function storedSeries(answer: SeriesLookup | Error) {
	const asked: number[][] = []
	const cull = { at: 1 }
	const stored = useStoredSeries(async (fileIds) => {
		asked.push([...fileIds])
		if (answer instanceof Error) {
			throw answer
		}
		return answer
	}, () => cull.at)
	return { stored, asked, cull }
}

describe('useStoredSeries', () => {
	// spec: SERIES-005.2
	it('reads the stored rows of every member of the opened pictures', async () => {
		const { stored, asked } = storedSeries({ series: [{ id: 5, fileIds: [2, 3], ...OPEN }], keptOut: [4] })

		stored.load(picturesOf(ENTRIES))
		await flushPromises()

		expect(asked).toEqual([[1, 3, 2, 4]])
		expect([...stored.rows.value]).toEqual([[4, null], [2, { id: 5, ...OPEN }], [3, { id: 5, ...OPEN }]])
	})

	// spec: SERIES-005.2
	it('drops an answer for a cull no longer open, and forgets the rows on reset', async () => {
		const { stored, cull } = storedSeries({ series: [], keptOut: [4] })
		stored.load(picturesOf(ENTRIES))
		cull.at = 2
		await flushPromises()
		expect(stored.rows.value.size).toBe(0)

		stored.load(picturesOf(ENTRIES))
		await flushPromises()
		stored.reset()
		expect(stored.rows.value.size).toBe(0)
	})

	// spec: SERIES-005.26
	it('logs a failed read and leaves every series automatic', async () => {
		const error = new Error('offline')
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { stored } = storedSeries(error)

		stored.load(picturesOf(ENTRIES))
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not read the stored series; every series shows as automatic', { error })
		expect(stored.rows.value.size).toBe(0)
	})

	// spec: SERIES-005.25
	it('reads the rows of files back it holds none of', async () => {
		const { stored, asked } = storedSeries({ series: [{ id: 6, fileIds: [9], ...OPEN }], keptOut: [] })

		stored.restore([9])
		await flushPromises()
		stored.restore([9])
		await flushPromises()

		expect(asked).toEqual([[9]])
		expect(stored.rows.value.get(9)).toEqual({ id: 6, ...OPEN })
	})

	// spec: SERIES-005.25
	it('logs a failed read of files back and drops an answer for a cull no longer open', async () => {
		const error = new Error('offline')
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		storedSeries(error).stored.restore([9])
		const { stored, cull } = storedSeries({ series: [], keptOut: [9] })
		stored.restore([9])
		cull.at = 2
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not read the stored series of the photos moved back', { error })
		expect(stored.rows.value.size).toBe(0)
	})
})
