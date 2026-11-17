// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { SeriesLookup } from '../../../src/logic/stored-series.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { allSeries, findSeries, openSeries, seriesCandidates } from '../../../src/logic/series.ts'
import { inDoneSeries, NO_STORED_ROWS, splitByStoredRows, withLookup } from '../../../src/logic/stored-series.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

/** Pictures `/P/<name>.JPG` with file ids from 1, shot at `time` by `camera`, with an optional visual hash. */
function shots(...specs: [name: string, time: number | null, camera?: string, hash?: string][]) {
	return picturesOf(specs.map(([name, time, camera = 'Canon EOS R5', visualHash = null], index) => listingEntry(index + 1, `/P/${name}.JPG`, { captureTime: time, camera, visualHash })))
}

const ALIKE = '0000000000000000'

/** The shown series of the pictures under the lookup's rows, as base names, with the flags by base name. */
function shownSeries(pictures: readonly Picture<ListingEntry>[], answer: SeriesLookup, flags: Record<string, Flag> = {}) {
	const decisionOf = (picture: Picture<ListingEntry>): Decision => ({ ...UNDECIDED, flag: flags[picture.baseName] ?? 'unflagged' })
	const hashOf = (picture: Picture<ListingEntry>) => picture.rendered?.visualHash ?? null
	const { stored, loose } = splitByStoredRows(pictures, withLookup(NO_STORED_ROWS, answer))
	return findSeries(allSeries(seriesCandidates(loose, hashOf), decisionOf, hashOf, stored), decisionOf)
}

const names = (series: ReturnType<typeof shownSeries>) => series.map(({ members }) => members.map((picture) => picture.baseName))

const storedSeries = (id: number, fileIds: number[], status: 'open' | 'done' = 'open', elsewhere = false) => ({ id, status, fileIds, elsewhere })

describe('withLookup', () => {
	it('keeps the rows already known over those the lookup answers', () => {
		const known = withLookup(NO_STORED_ROWS, { series: [storedSeries(7, [1])], keptOut: [] })

		const rows = withLookup(known, { series: [storedSeries(8, [1, 2], 'done', true)], keptOut: [3] })

		expect([...rows]).toEqual([[3, null], [1, { id: 7, status: 'open', elsewhere: false }], [2, { id: 8, status: 'done', elsewhere: true }]])
	})
})

describe('splitByStoredRows', () => {
	// spec: SERIES-005.2
	it('puts a picture in the series of a member, keeps it out when a member is kept out, and leaves the rest loose', () => {
		const pictures = picturesOf([
			listingEntry(1, '/P/A.JPG'),
			listingEntry(2, '/P/A.CR3', { mime: 'image/x-canon-cr3' }),
			listingEntry(3, '/P/B.JPG'),
			listingEntry(4, '/P/C.JPG'),
			listingEntry(5, '/P/D.JPG'),
		])

		const { stored, loose } = splitByStoredRows(pictures, withLookup(NO_STORED_ROWS, { series: [storedSeries(9, [1, 3])], keptOut: [2, 4] }))

		expect(stored.map(({ info, pictures: members }) => [info.id, members.map((picture) => picture.baseName)])).toEqual([[9, ['A', 'B']]])
		expect(loose.map((picture) => picture.baseName)).toEqual(['D'])
	})
})

describe('inDoneSeries', () => {
	// spec: SERIES-005.14
	it('is true for a picture whose member is in a done series, false in an open one, kept out or loose', () => {
		const [A, B, C, D] = picturesOf([
			listingEntry(1, '/P/A.JPG'),
			listingEntry(2, '/P/A.CR3', { mime: 'image/x-canon-cr3' }),
			listingEntry(3, '/P/B.JPG'),
			listingEntry(4, '/P/C.JPG'),
			listingEntry(5, '/P/D.JPG'),
		]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]
		const rows = withLookup(NO_STORED_ROWS, { series: [storedSeries(9, [2], 'done'), storedSeries(8, [3])], keptOut: [4] })

		expect([A, B, C, D].map((picture) => inDoneSeries(picture, rows))).toEqual([true, false, false, false])
	})
})

describe('allSeries with stored series', () => {
	// spec: SERIES-005.1
	it('keeps a stored series whole across cameras, hashes that differ and more than the span, ordered by capture time, then name', () => {
		const pictures = shots(['D', 200, 'X', 'ffffffffffffffff'], ['A', 10, 'Y', ALIKE], ['C', 100, 'X'], ['B', 100, 'X'])

		expect(names(shownSeries(pictures, { series: [storedSeries(5, [1, 2, 3, 4])], keptOut: [] }))).toEqual([['A', 'B', 'C', 'D']])
	})

	// spec: SERIES-005.1
	it('never adds a loose picture that would link to a stored series; it groups with other loose pictures only', () => {
		const pictures = shots(['A', 10, 'X', ALIKE], ['B', 11, 'X', ALIKE], ['C', 12, 'X', ALIKE], ['D', 13, 'X', ALIKE])

		expect(names(shownSeries(pictures, { series: [storedSeries(5, [1, 2])], keptOut: [] }))).toEqual([['A', 'B'], ['C', 'D']])
		expect(names(shownSeries(pictures.slice(0, 3), { series: [storedSeries(5, [1, 2])], keptOut: [] }))).toEqual([['A', 'B']])
	})

	// spec: SERIES-005.2
	it('groups only the loose pictures automatically and lists stored and automatic series by first capture time', () => {
		const pictures = shots(['A', 10], ['B', 13], ['C', 16], ['D', 17], ['E', 18], ['F', 500], ['G', 5])

		const shown = shownSeries(pictures, { series: [storedSeries(5, [6, 7])], keptOut: [2] })

		expect(names(shown)).toEqual([['G', 'F'], ['C', 'D', 'E']])
		expect(shown.map(({ key, stored }) => [key, stored])).toEqual([[7, { id: 5, status: 'open', elsewhere: false }], [3, undefined]])
	})

	// spec: SERIES-005.2
	it('orders a stored series whose first member has no capture time after the others', () => {
		const pictures = shots(['A', null], ['B', null], ['C', 10], ['D', 11])

		expect(names(shownSeries(pictures, { series: [storedSeries(5, [1, 2])], keptOut: [] }))).toEqual([['C', 'D'], ['A', 'B']])
	})

	// spec: SERIES-005.3
	it('hides rejected members and shows no series below two shown pictures; unflagging one shows it again', () => {
		const pictures = shots(['A', 10], ['B', 100], ['C', 200])
		const answer = { series: [storedSeries(5, [1, 2, 3])], keptOut: [] }

		expect(names(shownSeries(pictures, answer, { A: 'rejected' }))).toEqual([['B', 'C']])
		expect(names(shownSeries(pictures, answer, { A: 'rejected', B: 'rejected' }))).toEqual([])
		expect(names(shownSeries(pictures, answer, { B: 'rejected' }))).toEqual([['A', 'C']])
	})

	// spec: SERIES-005.1
	it('never marks a stored series as one that may still change while a member waits for its hash', () => {
		const pictures = shots(['A', 10], ['B', 11], ['C', 12], ['D', 13])
		const shown = shownSeries(pictures, { series: [storedSeries(5, [1, 2])], keptOut: [] })

		expect([...openSeries(shown, () => true)].map((picture) => picture.baseName)).toEqual(['C', 'D'])
	})
})
