// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullApi } from '../../src/cull-seams.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { fakeStorage, NO_SERIES, NO_TAGS, SET, stored, WRITING_ON } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

/** A cull opened on the entries over the given endpoints. */
function openedCull(entries: readonly ListingEntry[], api: Partial<CullApi> = {}) {
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async () => undefined,
		lookupSeries: NO_SERIES,
		tags: NO_TAGS,
		...api,
	}, fakeStorage(), () => WRITING_ON, { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) })
	cull.open(SET, entries)
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
