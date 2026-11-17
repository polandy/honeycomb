// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'
import type { StoredRows, StoredSeriesInfo } from '../../../src/logic/stored-series.ts'

import { describe, expect, it } from 'vitest'
import { dissolveChange, joinChange, newSeriesChange, removeChange, renameSeries, revertSeriesRows, seriesWrite, statusChange, withSeriesRows } from '../../../src/logic/series-edit.ts'
import { NO_STORED_ROWS } from '../../../src/logic/stored-series.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

const [A, B, C, D, E] = picturesOf([
	listingEntry(1, '/P/A.JPG'),
	listingEntry(2, '/P/A.CR3', { mime: 'image/x-canon-cr3' }),
	listingEntry(3, '/P/B.JPG'),
	listingEntry(4, '/P/C.JPG'),
	listingEntry(5, '/P/D.JPG'),
	listingEntry(6, '/P/E.JPG'),
]) as [Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>, Picture<ListingEntry>]

const OPEN_12 = { id: 12, status: 'open', elsewhere: false } as const
const DONE_12 = { id: 12, status: 'done', elsewhere: true } as const
const NEW = { id: -1, status: 'open', elsewhere: false } as const
const NEW_2 = { ...NEW, id: -2 }
const OPEN_13 = { id: 13, status: 'open', elsewhere: false } as const
const DONE_13 = { ...OPEN_13, status: 'done' } as const

const automatic: Series<Picture<ListingEntry>> = { key: 1, members: [A, B, C] }
const stored = (info: typeof OPEN_12 | typeof DONE_12): Series<Picture<ListingEntry>> => ({ key: 1, members: [A, B, C], stored: info })
const rowsOf = (entries: [number, StoredSeriesInfo | null][]): StoredRows => new Map(entries)
/** Local ids for new series, -1 first, as the stored series hand them out. */
function newIds() {
	let last = 0
	return () => --last
}

describe('removeChange', () => {
	// spec: SERIES-005.10, SERIES-005.16
	it('keeps the picture out of a stored series and leaves the other members as they are', () => {
		const rows = rowsOf([[1, DONE_12], [2, DONE_12], [3, DONE_12], [4, DONE_12]])

		expect(removeChange([stored(DONE_12)], [A], rows, newIds())).toEqual({
			after: [{ fileId: 2, place: 'keptOut' }, { fileId: 1, place: 'keptOut' }],
			before: [{ fileId: 2, place: DONE_12 }, { fileId: 1, place: DONE_12 }],
		})
	})

	// spec: SERIES-005.10
	it('stores an automatic series with the other shown members under the new id first, then keeps the picture out', () => {
		expect(removeChange([automatic], [B], NO_STORED_ROWS, newIds())).toEqual({
			after: [{ fileId: 2, place: NEW }, { fileId: 1, place: NEW }, { fileId: 4, place: NEW }, { fileId: 3, place: 'keptOut' }],
			before: [2, 1, 4, 3].map((fileId) => ({ fileId, place: 'loose' })),
		})
	})

	// spec: SERIES-005.11
	it('keeps out photos of several series and stores each automatic series with its rest under its own id', () => {
		const other: Series<Picture<ListingEntry>> = { key: 5, members: [D, E] }
		const change = removeChange([automatic, other], [A, D], NO_STORED_ROWS, newIds())

		expect(change.after).toEqual([
			{ fileId: 3, place: NEW },
			{ fileId: 4, place: NEW },
			{ fileId: 6, place: NEW_2 },
			{ fileId: 2, place: 'keptOut' },
			{ fileId: 1, place: 'keptOut' },
			{ fileId: 5, place: 'keptOut' },
		])
	})
})

describe('newSeriesChange', () => {
	// spec: SERIES-005.4
	it('puts loose and kept-out photos into one new series', () => {
		const change = newSeriesChange([], [A, D], rowsOf([[5, null]]), newIds())

		expect(change).toEqual({
			after: [2, 1, 5].map((fileId) => ({ fileId, place: NEW })),
			before: [{ fileId: 2, place: 'loose' }, { fileId: 1, place: 'loose' }, { fileId: 5, place: 'keptOut' }],
		})
	})

	// spec: SERIES-005.5
	it('takes photos out of their series, storing an automatic one with the members that stay', () => {
		const change = newSeriesChange([automatic], [B, D], NO_STORED_ROWS, newIds())

		expect(change.after).toEqual([
			{ fileId: 2, place: NEW },
			{ fileId: 1, place: NEW },
			{ fileId: 4, place: NEW },
			{ fileId: 3, place: NEW_2 },
			{ fileId: 5, place: NEW_2 },
		])
	})

	// spec: SERIES-005.5
	it('leaves the other members of a stored series where they are', () => {
		const rows = rowsOf([[1, OPEN_12], [2, OPEN_12], [3, OPEN_12], [4, OPEN_12]])

		expect(newSeriesChange([stored(OPEN_12)], [B, D], rows, newIds()).after).toEqual([3, 5].map((fileId) => ({ fileId, place: NEW })))
	})
})

describe('joinChange', () => {
	// spec: SERIES-005.6, SERIES-005.16
	it('adds loose photos to a stored series under its id, its listed rows too, and reopens it', () => {
		const rows = rowsOf([[9, DONE_12], [1, DONE_12], [2, DONE_12], [3, DONE_12], [4, DONE_12]])
		const open = { ...DONE_12, status: 'open' }

		const change = joinChange([stored(DONE_12)], [D], rows, newIds())

		expect(change.after).toEqual([2, 1, 3, 4, 9, 5].map((fileId) => ({ fileId, place: open })))
		expect(change.before.at(-1)).toEqual({ fileId: 5, place: 'loose' })
	})

	// spec: SERIES-005.6, SERIES-005.12
	it('stores an automatic series with the added photos under a new id', () => {
		expect(joinChange([automatic], [D], rowsOf([[5, null]]), newIds()).after).toEqual([2, 1, 3, 4, 5].map((fileId) => ({ fileId, place: NEW })))
	})

	// spec: SERIES-005.7
	it('merges the whole series and the loose photos under the first stored series\' id', () => {
		const rows = rowsOf([[3, OPEN_13], [9, OPEN_13]])
		const first: Series<Picture<ListingEntry>> = { key: 1, members: [A] }
		const second: Series<Picture<ListingEntry>> = { key: 3, members: [B, C], stored: OPEN_13 }

		expect(joinChange([first, second], [D], rows, newIds()).after).toEqual([2, 1, 3, 4, 9, 5].map((fileId) => ({ fileId, place: OPEN_13 })))
	})

	// spec: SERIES-005.9
	it('keeps a merge of done series done, and opens it when an open series or a loose photo joins', () => {
		const rows = rowsOf([[1, DONE_12], [2, DONE_12], [3, DONE_13], [4, DONE_13]])
		const twelve: Series<Picture<ListingEntry>> = { key: 1, members: [A], stored: DONE_12 }
		const thirteen: Series<Picture<ListingEntry>> = { key: 3, members: [B, C], stored: DONE_13 }

		expect(joinChange([twelve, thirteen], [], rows, newIds()).after.map(({ place }) => place)).toEqual(Array(4).fill(DONE_12))
		expect(joinChange([twelve, { ...thirteen, stored: OPEN_13 }], [], rows, newIds()).after[0]!.place).toEqual({ ...DONE_12, status: 'open' })
		expect(joinChange([twelve, thirteen], [D], rows, newIds()).after[0]!.place).toEqual({ ...DONE_12, status: 'open' })
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

describe('statusChange', () => {
	// spec: SERIES-005.14
	it('stores an automatic series done under a new id, with its shown members', () => {
		const change = statusChange(automatic, 'done', NO_STORED_ROWS, newIds())

		expect(change.after).toEqual([2, 1, 3, 4].map((fileId) => ({ fileId, place: { ...NEW, status: 'done' } })))
		expect(change.before).toEqual([2, 1, 3, 4].map((fileId) => ({ fileId, place: 'loose' })))
	})

	// spec: SERIES-005.14, SERIES-005.15
	it('sets the status of every listed row of a stored series, hidden ones too, and remembers their rows', () => {
		const rows = rowsOf([[9, DONE_12], [1, DONE_12], [2, DONE_12], [3, DONE_12], [4, DONE_12]])

		const change = statusChange({ key: 1, members: [A, C], stored: DONE_12 }, 'open', rows, newIds())

		expect(change.after).toEqual([2, 1, 4, 9, 3].map((fileId) => ({ fileId, place: { ...DONE_12, status: 'open' } })))
		expect(change.before).toEqual([2, 1, 4, 9, 3].map((fileId) => ({ fileId, place: DONE_12 })))
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
