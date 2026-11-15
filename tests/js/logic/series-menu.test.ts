// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Series } from '../../../src/logic/series.ts'

import { describe, expect, it } from 'vitest'
import { menuEntries, selectionChange, seriesOffer } from '../../../src/logic/series-menu.ts'
import { NO_STORED_ROWS } from '../../../src/logic/stored-series.ts'
import { listingEntry, picturesOf } from './listing-entries.ts'

type P = Picture<ListingEntry>

const [A, B, C, D, E] = picturesOf([1, 2, 3, 4, 5].map((fileId) => listingEntry(fileId, `/P/${fileId}.JPG`))) as [P, P, P, P, P]
const first: Series<P> = { key: 1, members: [A, B] }
const second: Series<P> = { key: 3, members: [C, D] }
const seriesOf = new Map<P, Series<P>>([[A, first], [B, first], [C, second], [D, second]])
const NEW = { id: -1, status: 'open', elsewhere: false } as const
const newIds = () => {
	let last = 0
	return () => --last
}

describe('seriesOffer', () => {
	// spec: SERIES-005.6, SERIES-005.7
	it('splits the selection into the series it touches, its photos in a series and its loose photos', () => {
		expect(seriesOffer([E, C, A, D], seriesOf)).toEqual({ selected: [E, C, A, D], touched: [second, first], inSeries: [C, A, D], loose: [E] })
	})
})

describe('menuEntries', () => {
	// spec: SERIES-005.4
	it('offers a new series first when no photo is in a series, and says why the others do not fit', () => {
		expect(menuEntries(seriesOffer([E], new Map()))).toEqual([
			{ edit: 'new', blocked: 'tooFew' },
			{ edit: 'add', blocked: 'noSeries' },
			{ edit: 'remove', blocked: 'noneInSeries' },
		])
	})

	// spec: SERIES-005.6, SERIES-005.11
	it('offers to add the loose photos to the one series the selection touches', () => {
		expect(menuEntries(seriesOffer([A, E], seriesOf))).toEqual([
			{ edit: 'add', blocked: null },
			{ edit: 'new', blocked: null },
			{ edit: 'remove', blocked: null },
		])
		expect(menuEntries(seriesOffer([A, B], seriesOf))[0]).toEqual({ edit: 'add', blocked: 'noLoose' })
	})

	// spec: SERIES-005.7
	it('offers a merge when the selection touches two series', () => {
		expect(menuEntries(seriesOffer([A, C], seriesOf)).map(({ edit }) => edit)).toEqual(['merge', 'new', 'remove'])
	})
})

describe('selectionChange', () => {
	// spec: SERIES-005.4
	it('makes a new series of the selected photos', () => {
		const { pictures, change, series } = selectionChange('new', seriesOffer([E, A], seriesOf), NO_STORED_ROWS, newIds())

		expect(pictures).toEqual([E, A])
		expect(series).toBe(1)
		expect(change.after.filter(({ place }) => place !== 'keptOut' && place !== 'loose' && place.id === -2).map(({ fileId }) => fileId)).toEqual([5, 1])
	})

	// spec: SERIES-005.6
	it('adds the loose photos to the touched series', () => {
		const { pictures, change } = selectionChange('add', seriesOffer([A, E], seriesOf), NO_STORED_ROWS, newIds())

		expect(pictures).toEqual([E])
		expect(change.after).toEqual([1, 2, 5].map((fileId) => ({ fileId, place: NEW })))
	})

	// spec: SERIES-005.7
	it('merges the touched series with the loose photos, naming every photo of the result', () => {
		const { pictures, series } = selectionChange('merge', seriesOffer([A, C, E], seriesOf), NO_STORED_ROWS, newIds())

		expect(pictures).toEqual([A, B, C, D, E])
		expect(series).toBe(2)
	})

	// spec: SERIES-005.11
	it('removes the photos in a series and keeps them out', () => {
		const { pictures, change } = selectionChange('remove', seriesOffer([A, E], seriesOf), NO_STORED_ROWS, newIds())

		expect(pictures).toEqual([A])
		expect(change.after.at(-1)).toEqual({ fileId: 1, place: 'keptOut' })
	})
})
