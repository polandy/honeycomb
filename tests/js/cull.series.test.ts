// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullApi } from '../../src/cull-seams.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { SeriesWrite } from '../../src/logic/series-edit.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { fakeStorage, NO_SERIES, NO_TAGS, SAVED_SERIES, SET, stored } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

/** A cull opened on the entries over the given endpoints. */
function openedCull(entries: readonly ListingEntry[], api: Partial<CullApi> = {}) {
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async () => undefined,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: NO_TAGS,
		...api,
	}, fakeStorage(), () => DEFAULT_SETTINGS, { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) })
	cull.open(SET, entries, [])
	return cull
}

/** Four shots a second apart, so the automatic rule makes them one series. */
const BURST = [10, 11, 12, 13].map((time, index) => listingEntry(index + 1, `/Trip/${String.fromCharCode(65 + index)}.JPG`, { captureTime: time }))

const names = (cull: ReturnType<typeof openedCull>) => cull.series.value.map(({ members }) => members.map((picture) => picture.baseName))

describe('useCull: open series', () => {
	// spec: SERIES-003.25
	it('marks the series with a member still without a hash as open', () => {
		const cull = openedCull([
			listingEntry(1, '/Trip/A.JPG', { captureTime: 10, visualHash: '0000000000000000' }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 11, visualHash: '0000000000000000' }),
			listingEntry(3, '/Trip/C.JPG', { captureTime: 500 }),
			listingEntry(4, '/Trip/D.JPG', { captureTime: 501 }),
		])

		expect([...cull.openSeries.value].map((each) => each.baseName)).toEqual(['C', 'D'])
	})
})

describe('useCull: stored series', () => {
	// spec: SERIES-005.2
	it('takes stored series and kept-out pictures out before the automatic rule', async () => {
		const cull = openedCull([...BURST, listingEntry(5, '/Trip/E.JPG', { captureTime: 14 })], {
			lookupSeries: async () => ({ series: [{ id: 7, status: 'done', fileIds: [1, 4], elsewhere: true }], keptOut: [2] }),
		})
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D', 'E']])

		await flushPromises()

		expect(names(cull)).toEqual([['A', 'D'], ['C', 'E']])
		expect(cull.series.value[0]!.stored).toEqual({ id: 7, status: 'done', elsewhere: true })
	})

	// spec: SERIES-005.26
	it('logs a failed read, keeps every series automatic and still reads the decisions', async () => {
		const error = new Error('offline')
		const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const cull = openedCull(BURST, { lookupSeries: async () => Promise.reject(error), lookupDecisions: async () => [stored(1, 'picked')] })
		await flushPromises()

		expect(logged).toHaveBeenCalledWith('Could not read the stored series; every series shows as automatic', { error })
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])
		expect(cull.decisionOf(cull.series.value[0]!.members[0]!).flag).toBe('picked')
	})

	// spec: SERIES-005.25
	it('reads the stored series of files moved back under a new file id', async () => {
		const asked: number[][] = []
		const cull = openedCull(BURST, {
			lookupSeries: async (fileIds) => {
				asked.push([...fileIds])
				return { series: [{ id: 7, status: 'open', fileIds: [...fileIds], elsewhere: false }], keptOut: [] }
			},
		})
		await flushPromises()
		cull.removeFiles(new Set([1]))

		cull.restoreFiles([{ ...BURST[0]!, fileId: 9 }])
		await flushPromises()

		expect(asked).toEqual([[1, 2, 3, 4], [9]])
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])
		expect(cull.series.value[0]!.stored?.id).toBe(7)
	})
})

describe('useCull: series edits', () => {
	/** A cull on the burst that records its series writes and answers new series with ids from 31 on. */
	function editedCull(api: Partial<CullApi> = {}) {
		const written: SeriesWrite[] = []
		const cull = openedCull(BURST, {
			saveSeries: async (write) => {
				written.push(write)
				return { ids: write.series.map(({ id }, index) => id ?? 31 + index) }
			},
			...api,
		})
		return { cull, written }
	}

	// spec: SERIES-005.10
	it('removes a picture from an automatic series as one undo step: the rest is stored, the picture kept out', async () => {
		const { cull, written } = editedCull()
		await flushPromises()
		const [series] = cull.series.value

		const step = cull.removeFromSeries(series!, series!.members[1]!)
		await flushPromises()

		expect(step).toMatchObject({ kind: 'series', edit: 'remove', names: ['B'] })
		expect(written).toEqual([{ series: [{ id: null, status: 'open', fileIds: [1, 3, 4] }], keptOut: [2], released: [] }])
		expect(names(cull)).toEqual([['A', 'C', 'D']])
		expect(cull.series.value[0]!.stored).toEqual({ id: 31, status: 'open', elsewhere: false })

		expect(cull.undo()).toBe(step)
		await flushPromises()
		expect(written.at(-1)).toEqual({ series: [], keptOut: [], released: [1, 3, 4, 2] })
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])
		expect(cull.series.value[0]!.stored).toBeUndefined()
	})

	// spec: SERIES-005.13
	it('dissolves a stored series as one undo step and brings it back with the same members', async () => {
		const { cull, written } = editedCull({ lookupSeries: async () => ({ series: [{ id: 12, status: 'done', fileIds: [1, 2, 3, 4], elsewhere: false }], keptOut: [] }) })
		await flushPromises()

		const step = cull.dissolveSeries(cull.series.value[0]!)
		await flushPromises()

		expect(step).toMatchObject({ kind: 'series', edit: 'dissolve', names: ['A', 'B', 'C', 'D'] })
		expect(written).toEqual([{ series: [], keptOut: [1, 2, 3, 4], released: [] }])
		expect(names(cull)).toEqual([])

		cull.undo()
		await flushPromises()
		expect(written.at(-1)).toEqual({ series: [{ id: 12, status: 'done', fileIds: [1, 2, 3, 4] }], keptOut: [], released: [] })
		expect(cull.series.value[0]!.stored?.id).toBe(12)

		cull.redo()
		expect(names(cull)).toEqual([])
	})

	// spec: SERIES-005.4, SERIES-005.5
	it('makes a new series of the selected pictures as one undo step, storing the rest of their series', async () => {
		const { cull, written } = editedCull()
		await flushPromises()
		const [A, B, C, D] = cull.pictures.value

		const step = cull.editSelection('new', [C!, D!])
		await flushPromises()

		expect(step).toMatchObject({ kind: 'series', edit: 'new', names: ['C', 'D'], series: 1 })
		expect(written).toEqual([{ series: [{ id: null, status: 'open', fileIds: [1, 2] }, { id: null, status: 'open', fileIds: [3, 4] }], keptOut: [], released: [] }])
		expect(cull.series.value.map(({ members }) => members)).toEqual([[A, B], [C, D]])

		cull.undo()
		await flushPromises()
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])
	})

	// spec: SERIES-005.7
	it('merges the series the selection touches, naming every photo of the merged series', async () => {
		const { cull } = editedCull({ lookupSeries: async () => ({ series: [{ id: 12, status: 'open' as const, fileIds: [1, 2] }, { id: 13, status: 'open' as const, fileIds: [3, 4] }].map((series) => ({ ...series, elsewhere: false })), keptOut: [] }) })
		await flushPromises()
		const [A, , C] = cull.pictures.value

		const step = cull.editSelection('merge', [A!, C!])
		await flushPromises()

		expect(step).toMatchObject({ edit: 'merge', names: ['A', 'B', 'C', 'D'], series: 2 })
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])
		expect(cull.series.value[0]!.stored?.id).toBe(12)
	})

	// spec: SERIES-005.8, SERIES-005.9
	it('merges two series under the first one\'s id as one undo step, open unless both were done', async () => {
		const { cull, written } = editedCull({ lookupSeries: async () => ({ series: [{ id: 12, status: 'done' as const, fileIds: [1, 2] }, { id: 13, status: 'open' as const, fileIds: [3, 4] }].map((series) => ({ ...series, elsewhere: false })), keptOut: [] }) })
		await flushPromises()

		const step = cull.mergeSeries(cull.everySeries.value)
		await flushPromises()

		expect(step).toMatchObject({ kind: 'series', edit: 'merge', names: ['A', 'B', 'C', 'D'], series: 2 })
		expect(written).toEqual([{ series: [{ id: 12, status: 'open', fileIds: [1, 2, 3, 4] }], keptOut: [], released: [] }])
		expect(names(cull)).toEqual([['A', 'B', 'C', 'D']])

		cull.undo()
		await flushPromises()
		expect(written.at(-1)).toEqual({ series: [{ id: 12, status: 'done', fileIds: [1, 2] }, { id: 13, status: 'open', fileIds: [3, 4] }], keptOut: [], released: [] })
	})
})
