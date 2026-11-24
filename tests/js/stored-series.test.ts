// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SeriesWrite } from '../../src/logic/series-edit.ts'
import type { SeriesLookup } from '../../src/logic/stored-series.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useStoredSeries } from '../../src/series/stored-series.ts'
import { logger } from '../../src/shared/logger.ts'
import { ENTRIES } from './app-cull.ts'
import { picturesOf } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

const OPEN = { status: 'open', elsewhere: false } as const

/** Stored series over a lookup that answers `answer`, or fails with it, and a save that answers `saved` in turn, for the cull `cull.at`. */
function storedSeries(answer: SeriesLookup | Error, saved: (number[] | Error)[] = []) {
	const asked: number[][] = []
	const written: SeriesWrite[] = []
	const cull = { at: 1 }
	const stored = useStoredSeries({
		lookupSeries: async (fileIds) => {
			asked.push([...fileIds])
			if (answer instanceof Error) {
				throw answer
			}
			return answer
		},
		saveSeries: async (write) => {
			written.push(write)
			const ids = saved.shift() ?? []
			if (ids instanceof Error) {
				throw ids
			}
			return { ids }
		},
	}, () => cull.at)
	return { stored, asked, written, cull }
}

const NEW = { status: 'open', elsewhere: false } as const

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

	// spec: SERIES-005.30
	it('is loading from the read of the opened pictures until its answer', async () => {
		const { stored } = storedSeries({ series: [], keptOut: [4] })
		expect(stored.loading.value).toBe(false)

		stored.load(picturesOf(ENTRIES))
		expect(stored.loading.value).toBe(true)
		await flushPromises()

		expect(stored.loading.value).toBe(false)
	})

	// spec: SERIES-005.30
	it('is loading from the read of files back until it fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { stored } = storedSeries(new Error('offline'))

		stored.restore([7])
		expect(stored.loading.value).toBe(true)
		await flushPromises()

		expect(stored.loading.value).toBe(false)
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

	// spec: SERIES-005.10, SERIES-005.22
	it('shows an edit at once, sends it, and gives a new series the id the server answered', async () => {
		const { stored, written } = storedSeries({ series: [], keptOut: [] }, [[31]])
		const id = stored.newId()

		void stored.store([{ fileId: 1, place: { id, ...NEW } }, { fileId: 2, place: 'keptOut' }])
		expect([...stored.rows.value]).toEqual([[1, { id, ...NEW }], [2, null]])
		await flushPromises()

		expect(written).toEqual([{ series: [{ id: null, status: 'open', fileIds: [1] }], keptOut: [2], released: [] }])
		expect([...stored.rows.value]).toEqual([[1, { id: 31, ...NEW }], [2, null]])
	})

	// spec: SERIES-005.10
	it('writes a series by the id the server answered once it has one, also when the server replaced it', async () => {
		const { stored, written } = storedSeries({ series: [], keptOut: [] }, [[31], [], [40], [40]])
		const id = stored.newId()
		void stored.store([{ fileId: 1, place: { id, ...NEW } }])
		await flushPromises()

		void stored.store([{ fileId: 1, place: 'loose' }])
		void stored.store([{ fileId: 1, place: { id, ...NEW } }])
		await flushPromises()
		void stored.store([{ fileId: 3, place: { id: 31, ...NEW } }])
		await flushPromises()

		expect(written.slice(1)).toEqual([
			{ series: [], keptOut: [], released: [1] },
			{ series: [{ id: 31, status: 'open', fileIds: [1] }], keptOut: [], released: [] },
			{ series: [{ id: 40, status: 'open', fileIds: [3] }], keptOut: [], released: [] },
		])
		expect([...stored.rows.value]).toEqual([[1, { id: 40, ...NEW }], [3, { id: 40, ...NEW }]])
	})

	// spec: SERIES-005.19
	it('logs a failed save and puts back the rows it replaced', async () => {
		const error = new Error('offline')
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { stored } = storedSeries({ series: [{ id: 12, fileIds: [1, 2], ...OPEN }], keptOut: [] }, [error])
		stored.load(picturesOf(ENTRIES))
		await flushPromises()

		void stored.store([{ fileId: 1, place: 'keptOut' }])
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not save the series', { error })
		expect(stored.rows.value.get(1)).toEqual({ id: 12, ...OPEN })
	})

	// spec: SERIES-005.19
	it('puts nothing back once another cull opened', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { stored, cull } = storedSeries({ series: [], keptOut: [] }, [new Error('offline')])

		void stored.store([{ fileId: 1, place: 'keptOut' }])
		cull.at = 2
		await flushPromises()

		expect(stored.rows.value.get(1)).toBeNull()
	})
})
