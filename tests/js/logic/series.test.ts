// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { findSeries, SERIES_GAP_SECONDS, seriesCandidates, seriesSizes } from '../../../src/logic/series.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

/** Pictures named `/<folder>/<name>.JPG`, shot at `time` by `camera`. */
function shots(...specs: [name: string, time: number | null, camera?: string | null][]) {
	return picturesOf(specs.map(([name, time, camera = 'Canon EOS R5'], index) => listingEntry(index + 1, `/${name}.JPG`, { captureTime: time, camera, mtime: 5000 })))
}

const names = (series: readonly (readonly Picture<ListingEntry>[])[]) => series.map((each) => each.map((picture) => picture.baseName))

/** The series of the pictures with the given flags by base name, undecided otherwise. */
function seriesOf(pictures: readonly Picture<ListingEntry>[], flags: Record<string, Flag> = {}) {
	const decisionOf = (picture: Picture<ListingEntry>): Decision => ({ ...UNDECIDED, flag: flags[picture.baseName] ?? 'unflagged' })
	return names(findSeries(seriesCandidates(pictures), decisionOf))
}

describe('findSeries', () => {
	// spec: SERIES-001.1
	it('groups shots of one camera at most the gap apart, photo to photo, in capture-time order and across folders', () => {
		const pictures = shots(['A/C', 106, 'X'], ['B/A', 100, 'X'], ['A/B', 100 + SERIES_GAP_SECONDS, 'X'])

		expect(seriesOf(pictures)).toEqual([['A', 'B', 'C']])
	})

	// spec: SERIES-001.2
	it('starts a new series after a longer gap or with another camera, ordered by the first capture time', () => {
		const pictures = shots(['P/E', 50, 'Y'], ['P/F', 51, 'Y'], ['P/A', 10], ['P/B', 12], ['P/C', 16], ['P/D', 17], ['P/G', 52])

		expect(seriesOf(pictures)).toEqual([['A', 'B'], ['C', 'D'], ['E', 'F']])
	})

	// spec: SERIES-001.1
	it('counts pictures without a camera as one camera and orders same-time shots by name', () => {
		expect(seriesOf(shots(['P/B', 10, null], ['P/A', 10, null]))).toEqual([['A', 'B']])
	})

	// spec: SERIES-001.3
	it('leaves out pictures without a capture time, whatever their modification time', () => {
		expect(seriesOf(shots(['P/A', 10], ['P/B', null], ['P/C', null]))).toEqual([])
	})

	// spec: SERIES-001.4
	it.each([
		[5, [3, 2]],
		[8, [4, 4]],
		[9, [3, 3, 3]],
		[4, [4]],
	])('splits a run of %i into series of %o', (count, sizes) => {
		const pictures = shots(...Array.from({ length: count }, (_, index) => [`P/${String.fromCharCode(65 + index)}`, index] as [string, number]))

		expect(seriesOf(pictures).map((series) => series.length)).toEqual(sizes)
	})

	// spec: SERIES-001.5
	it('leaves out rejected pictures before it measures the gaps', () => {
		const pictures = shots(['P/A', 0], ['P/B', 3], ['P/C', 6], ['P/D', 7])

		expect(seriesOf(pictures, { B: 'rejected' })).toEqual([['C', 'D']])
	})

	// spec: SERIES-001.5
	it('offers no series of a single picture or without an undecided one', () => {
		const pictures = shots(['P/A', 0], ['P/B', 1], ['P/C', 10], ['P/D', 11])

		expect(seriesOf(pictures, { A: 'picked', B: 'picked', D: 'rejected' })).toEqual([])
	})

	// spec: SERIES-001.5
	it('keeps a series with one undecided picture beside picked ones', () => {
		expect(seriesOf(shots(['P/A', 0], ['P/B', 1]), { A: 'picked' })).toEqual([['A', 'B']])
	})

	it('takes the capture time and camera of either member of a pair', () => {
		const pictures = picturesOf([
			listingEntry(1, '/P/A.JPG'),
			listingEntry(2, '/P/A.NEF', { mime: 'image/x-dcraw', captureTime: 10, camera: 'Nikon Z8' }),
			listingEntry(3, '/P/B.JPG', { captureTime: 11, camera: 'Nikon Z8' }),
		])

		expect(seriesOf(pictures)).toEqual([['A', 'B']])
	})
})

describe('seriesSizes', () => {
	// spec: SERIES-002.10
	it('maps each picture of a series to the size of its series', () => {
		const sizes = seriesSizes([['A', 'B', 'C'], ['D', 'E']])

		expect([...sizes]).toEqual([['A', 3], ['B', 3], ['C', 3], ['D', 2], ['E', 2]])
	})
})
