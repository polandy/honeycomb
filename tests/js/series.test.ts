// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { NO_STORED_ROWS } from '../../src/logic/stored-series.ts'
import { useSeries } from '../../src/series.ts'
import { fakeStorage } from './app-cull.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'
import { fakeHasher } from './visual-hash-fakes.ts'

/** The series state over `entries`, with a hasher the test settles and decisions it changes. */
function setUp(entries: ListingEntry[]) {
	const hasher = fakeHasher()
	const pictures = shallowRef<Picture<ListingEntry>[]>(picturesOf(entries))
	const decisions = shallowRef<ReadonlyMap<Picture<ListingEntry>, Decision>>(new Map())
	const series = useSeries({ hashImage: hasher.hashImage, saveVisualHashes: async () => undefined, wait: async () => {} }, fakeStorage(), () => pictures.value, (picture) => decisions.value.get(picture) ?? UNDECIDED, () => NO_STORED_ROWS)
	const byName = (name: string) => pictures.value.find((picture) => picture.baseName === name)!
	const names = () => series.series.value.map((each) => each.members.map((member) => member.baseName))
	return { ...hasher, series, decisions, byName, names }
}

describe('useSeries', () => {
	// spec: SERIES-001.1, SERIES-001.5
	it('forms the series of the pictures and leaves a picture out once it is rejected', () => {
		const { series, decisions, byName, names } = setUp([
			listingEntry(1, '/Trip/A.JPG', { captureTime: 10 }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 11 }),
			listingEntry(3, '/Trip/C.JPG', { captureTime: 12 }),
		])
		expect(names()).toEqual([['A', 'B', 'C']])

		decisions.value = new Map([[byName('B'), { ...UNDECIDED, flag: 'rejected' }]])
		expect(names()).toEqual([['A', 'C']])
		expect(series.seriesOf.value.has(byName('B'))).toBe(false)
		expect(series.seriesOf.value.get(byName('A'))?.members.map((member) => member.baseName)).toEqual(['A', 'C'])
	})

	// spec: SERIES-001.14, SERIES-003.25
	it('joins shots that look alike once their hashes arrive and keeps the series open until then', async () => {
		const { calls, series, byName, names } = setUp([
			listingEntry(1, '/Trip/A.JPG', { captureTime: 0 }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 1 }),
			listingEntry(3, '/Trip/C.JPG', { captureTime: 10 }),
		])
		expect(names()).toEqual([['A', 'B']])
		expect([...series.openSeries.value].map((each) => each.baseName)).toEqual(['A', 'B'])
		expect(series.hashProgress.value).toMatchObject({ phase: 'running', hashed: 0, total: 3 })

		for (const call of calls) {
			call.resolve('0000000000000000')
			await flushPromises()
		}

		expect(names()).toEqual([['A', 'B', 'C']])
		expect(series.openSeries.value.size).toBe(0)
		expect(series.seriesOf.value.get(byName('C'))?.members).toHaveLength(3)
	})

	// spec: SERIES-002.12, SERIES-003.25
	it('keeps a settled series open while its hashes are pending, so its bracket stays dashed', () => {
		const { series, decisions, byName } = setUp([
			listingEntry(1, '/Trip/A.JPG', { captureTime: 0 }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 1 }),
		])
		decisions.value = new Map(['A', 'B'].map((name) => [byName(name), { ...UNDECIDED, flag: 'picked' }]))

		expect(series.series.value).toEqual([])
		expect([...series.openSeries.value].map((each) => each.baseName)).toEqual(['A', 'B'])
	})

	// spec: SERIES-001.18
	it('holds the series still while the hashes are held and joins them on release', async () => {
		const { calls, series, names } = setUp([
			listingEntry(1, '/Trip/A.JPG', { captureTime: 0 }),
			listingEntry(2, '/Trip/B.JPG', { captureTime: 10 }),
		])
		series.holdHashes(true)
		calls[0]!.resolve('0000000000000000')
		await flushPromises()
		calls[1]!.resolve('0000000000000000')
		await flushPromises()

		expect(names()).toEqual([])
		series.holdHashes(false)
		expect(names()).toEqual([['A', 'B']])
	})
})
