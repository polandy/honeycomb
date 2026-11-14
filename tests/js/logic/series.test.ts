// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { allSeries, findSeries, hashablePictures, SERIES_GAP_SECONDS, SERIES_SPAN_SECONDS, seriesCandidates, seriesMembers, seriesSizes, VISUAL_DISTANCE_LIMIT, VISUAL_SERIES_GAP_SECONDS } from '../../../src/logic/series.ts'
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
	it.each([4, 5, 9, 26])('keeps a run of %i as one series', (count) => {
		const pictures = shots(...Array.from({ length: count }, (_, index) => [`P/${String.fromCharCode(65 + index)}`, index] as [string, number]))

		expect(seriesOf(pictures).map((series) => series.length)).toEqual([count])
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

/** A visual hash with the lowest `bits` bits set, `bits` away from `hash(0)`. */
const hash = (bits: number) => (2n ** BigInt(bits) - 1n).toString(16).padStart(16, '0')

/** The series of the pictures with the visual hashes by base name, none otherwise. */
function visualSeries(pictures: readonly Picture<ListingEntry>[], hashes: Record<string, string>, flags: Record<string, Flag> = {}) {
	const decisionOf = (picture: Picture<ListingEntry>): Decision => ({ ...UNDECIDED, flag: flags[picture.baseName] ?? 'unflagged' })
	const hashOf = (picture: Picture<ListingEntry>) => hashes[picture.baseName] ?? null
	return names(findSeries(seriesCandidates(pictures, hashOf), decisionOf, hashOf))
}

describe('findSeries with visual hashes', () => {
	// spec: SERIES-001.14
	it('groups shots that look alike up to the wider gap apart', () => {
		const pictures = shots(['P/A', 0], ['P/B', VISUAL_SERIES_GAP_SECONDS], ['P/C', 2 * VISUAL_SERIES_GAP_SECONDS + 1])

		expect(visualSeries(pictures, { A: hash(0), B: hash(1), C: hash(1) })).toEqual([['A', 'B']])
	})

	// spec: SERIES-001.14
	it('takes a difference up to the limit as alike', () => {
		const pictures = shots(['P/A', 0], ['P/B', 10], ['P/C', 20])

		expect(visualSeries(pictures, { A: hash(0), B: hash(VISUAL_DISTANCE_LIMIT), C: hash(2 * VISUAL_DISTANCE_LIMIT + 1) })).toEqual([['A', 'B']])
	})

	// spec: SERIES-001.15
	it('keeps shots that look different apart, however close in time', () => {
		const pictures = shots(['P/A', 0], ['P/B', 1], ['P/C', 2])

		expect(visualSeries(pictures, { A: hash(0), B: hash(VISUAL_DISTANCE_LIMIT + 1), C: hash(VISUAL_DISTANCE_LIMIT + 1) })).toEqual([['B', 'C']])
	})

	// spec: SERIES-001.15
	it('keeps another camera apart, however alike', () => {
		expect(visualSeries(shots(['P/A', 0, 'X'], ['P/B', 1, 'Y']), { A: hash(0), B: hash(0) })).toEqual([])
	})

	// spec: SERIES-001.16
	it('falls back to the time rule where a picture has no hash yet', () => {
		const pictures = shots(['P/A', 0], ['P/B', SERIES_GAP_SECONDS], ['P/C', 10], ['P/D', 20])

		expect(visualSeries(pictures, { A: hash(64), C: hash(0), D: hash(0) })).toEqual([['A', 'B'], ['C', 'D']])
		expect(visualSeries(pictures, { A: hash(0), C: hash(0) })).toEqual([['A', 'B']])
	})

	// spec: SERIES-001.5, SERIES-001.14
	it('measures the visual gap again once rejected pictures are left out', () => {
		const pictures = shots(['P/A', 0], ['P/B', 20], ['P/C', 40], ['P/D', 60])
		const hashes = { A: hash(0), B: hash(0), C: hash(0), D: hash(64) }

		expect(visualSeries(pictures, hashes)).toEqual([['A', 'B', 'C']])
		expect(visualSeries(pictures, hashes, { B: 'rejected' })).toEqual([])
	})
})

describe('findSeries with the series span', () => {
	// spec: SERIES-001.22
	it('ends a series of close shots once a shot lies more than the span after its first, and starts the next there', () => {
		const pictures = shots(...Array.from({ length: 23 }, (_, index) => [`P/${String(index).padStart(2, '0')}`, index * SERIES_GAP_SECONDS] as [string, number]))

		expect(seriesOf(pictures).map((series) => series.length)).toEqual([SERIES_SPAN_SECONDS / SERIES_GAP_SECONDS + 1, 2])
	})

	// spec: SERIES-001.22
	it('ends a series of alike shots after the span, keeping a shot exactly the span after the first', () => {
		const step = SERIES_SPAN_SECONDS / 3
		const pictures = shots(['P/A', 0], ['P/B', step], ['P/C', 2 * step], ['P/D', 3 * step], ['P/E', 4 * step], ['P/F', 5 * step])
		const hashes = Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F'].map((name) => [name, hash(0)]))

		expect(visualSeries(pictures, hashes)).toEqual([['A', 'B', 'C', 'D'], ['E', 'F']])
	})

	// spec: SERIES-001.5, SERIES-001.22
	it('measures the span from the first picture that is not rejected', () => {
		const step = SERIES_SPAN_SECONDS / 3
		const pictures = shots(['P/A', 0], ['P/B', step], ['P/C', 2 * step], ['P/D', 3 * step], ['P/E', 4 * step])
		const hashes = Object.fromEntries(['A', 'B', 'C', 'D', 'E'].map((name) => [name, hash(0)]))

		expect(visualSeries(pictures, hashes, { A: 'rejected' })).toEqual([['B', 'C', 'D', 'E']])
	})
})

describe('hashablePictures', () => {
	// spec: SERIES-001.17
	it('lists the pictures with a shot of the same camera within the wider gap', () => {
		const pictures = shots(['P/A', 0], ['P/B', VISUAL_SERIES_GAP_SECONDS], ['P/C', 3 * VISUAL_SERIES_GAP_SECONDS, 'X'], ['P/D', 3 * VISUAL_SERIES_GAP_SECONDS + 1, 'Y'], ['P/E', null])

		expect(hashablePictures(pictures).map((picture) => picture.baseName)).toEqual(['A', 'B'])
	})
})

describe('seriesSizes', () => {
	// spec: SERIES-002.10
	it('maps each picture of a series to the size of its series', () => {
		const sizes = seriesSizes([['A', 'B', 'C'], ['D', 'E']])

		expect([...sizes]).toEqual([['A', 3], ['B', 3], ['C', 3], ['D', 2], ['E', 2]])
	})
})

describe('allSeries', () => {
	// spec: LOUPE-001.19
	it('keeps every series of two or more pictures that are not rejected, decided or not', () => {
		const pictures = shots(['P/A', 0], ['P/B', 1], ['P/C', 2], ['P/D', 10], ['P/E', 11])
		const decisionOf = (picture: Picture<ListingEntry>): Decision => ({ ...UNDECIDED, flag: picture.baseName === 'E' ? 'rejected' : 'picked' })

		expect(names(allSeries(seriesCandidates(pictures), decisionOf))).toEqual([['A', 'B', 'C']])
	})
})

describe('seriesMembers', () => {
	// spec: LOUPE-001.19
	it('maps each picture of a series to its whole series', () => {
		const first = ['A', 'B']
		const second = ['C', 'D']
		const members = seriesMembers([first, second])

		expect([...members]).toEqual([['A', first], ['B', first], ['C', second], ['D', second]])
	})
})
