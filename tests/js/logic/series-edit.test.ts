// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'
import type { StoredRows, StoredSeriesInfo } from '../../../src/logic/stored-series.ts'

import { describe, expect, it } from 'vitest'
import { dissolveChange, removeChange, renameSeries, revertSeriesRows, seriesWrite, withSeriesRows } from '../../../src/logic/series-edit.ts'
import { NO_STORED_ROWS } from '../../../src/logic/stored-series.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const [A, B, C] = picturesOf([
	listingEntry(1, '/P/A.JPG'),
	listingEntry(2, '/P/A.CR3', { mime: 'image/x-canon-cr3' }),
	listingEntry(3, '/P/B.JPG'),
	listingEntry(4, '/P/C.JPG'),
]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]

const OPEN_12 = { id: 12, status: 'open', elsewhere: false } as const
const DONE_12 = { id: 12, status: 'done', elsewhere: true } as const
const NEW = { id: -1, status: 'open', elsewhere: false } as const

const automatic: Series<Picture<ListingEntry>> = { key: 1, members: [A, B, C] }
const stored = (info: typeof OPEN_12 | typeof DONE_12): Series<Picture<ListingEntry>> => ({ key: 1, members: [A, B, C], stored: info })
const rowsOf = (entries: [number, StoredSeriesInfo | null][]): StoredRows => new Map(entries)

describe('removeChange', () => {
	// spec: SERIES-005.10
	it('keeps the picture out of a stored series and leaves the other members as they are', () => {
		const rows = rowsOf([[1, DONE_12], [2, DONE_12], [3, DONE_12], [4, DONE_12]])

		expect(removeChange(stored(DONE_12), A, rows, -1)).toEqual({
			after: [{ fileId: 2, place: 'keptOut' }, { fileId: 1, place: 'keptOut' }],
			before: [{ fileId: 2, place: DONE_12 }, { fileId: 1, place: DONE_12 }],
		})
	})

	// spec: SERIES-005.10
	it('stores an automatic series with the other shown members under the new id first, then keeps the picture out', () => {
		expect(removeChange(automatic, B, NO_STORED_ROWS, -1)).toEqual({
			after: [{ fileId: 2, place: NEW }, { fileId: 1, place: NEW }, { fileId: 4, place: NEW }, { fileId: 3, place: 'keptOut' }],
			before: [2, 1, 4, 3].map((fileId) => ({ fileId, place: 'loose' })),
		})
	})
})

describe('dissolveChange', () => {
	// spec: SERIES-005.13
	it('keeps out every shown member of an automatic series', () => {
		expect(dissolveChange(automatic, NO_STORED_ROWS).after).toEqual([2, 1, 3, 4].map((fileId) => ({ fileId, place: 'keptOut' })))
	})

	// spec: SERIES-005.13
	it('keeps out every listed member of a stored series, hidden ones too, and remembers their rows', () => {
		const rows = rowsOf([[9, OPEN_12], [1, OPEN_12], [2, OPEN_12], [3, OPEN_12], [4, OPEN_12], [5, null]])

		const change = dissolveChange({ key: 1, members: [A, C], stored: OPEN_12 }, rows)

		expect(change.after).toEqual([2, 1, 4, 9, 3].map((fileId) => ({ fileId, place: 'keptOut' })))
		expect(change.before).toEqual([2, 1, 4, 9, 3].map((fileId) => ({ fileId, place: OPEN_12 })))
	})
})

describe('withSeriesRows', () => {
	// spec: SERIES-005.10
	it('puts each file in its series, keeps it out or makes it loose', () => {
		const rows = withSeriesRows(rowsOf([[1, OPEN_12], [2, OPEN_12], [3, null]]), [
			{ fileId: 1, place: 'keptOut' },
			{ fileId: 2, place: 'loose' },
			{ fileId: 3, place: DONE_12 },
		])

		expect([...rows]).toEqual([[1, null], [3, DONE_12]])
	})
})

describe('revertSeriesRows', () => {
	// spec: SERIES-005.19
	it('puts back the earlier row of each unsaved file that a later edit left alone', () => {
		const before = rowsOf([[1, OPEN_12], [2, OPEN_12]])
		const rows = rowsOf([[1, null], [2, DONE_12], [3, null]])

		const reverted = revertSeriesRows(rows, [{ fileId: 1, place: 'keptOut' }, { fileId: 2, place: 'keptOut' }, { fileId: 3, place: 'keptOut' }], before)

		expect([...reverted]).toEqual([[1, OPEN_12], [2, DONE_12]])
	})

	// spec: SERIES-005.19
	it('tells series apart by id and status', () => {
		const rows = rowsOf([[1, OPEN_12], [2, DONE_12]])

		const reverted = revertSeriesRows(rows, [{ fileId: 1, place: { ...OPEN_12, id: 13 } }, { fileId: 2, place: OPEN_12 }, { fileId: 3, place: 'loose' }], rowsOf([[3, null]]))

		expect([...reverted]).toEqual([[1, OPEN_12], [2, DONE_12], [3, null]])
	})
})

describe('renameSeries', () => {
	// spec: SERIES-005.10
	it('gives the rows of a series the id the server answered', () => {
		const rows = renameSeries(rowsOf([[1, NEW], [2, null], [3, OPEN_12]]), -1, 31)

		expect([...rows]).toEqual([[1, { ...NEW, id: 31 }], [2, null], [3, OPEN_12]])
	})
})

describe('seriesWrite', () => {
	// spec: SERIES-005.21, SERIES-005.22
	it('groups the rows into series items, newest status last, with kept-out and released files', () => {
		const { write, refs } = seriesWrite([
			{ fileId: 1, place: OPEN_12 },
			{ fileId: 2, place: NEW },
			{ fileId: 3, place: DONE_12 },
			{ fileId: 4, place: 'keptOut' },
			{ fileId: 5, place: 'loose' },
		], (id) => (id > 0 ? id : null))

		expect(write).toEqual({
			series: [{ id: 12, status: 'done', fileIds: [1, 3] }, { id: null, status: 'open', fileIds: [2] }],
			keptOut: [4],
			released: [5],
		})
		expect(refs).toEqual([12, -1])
	})
})
