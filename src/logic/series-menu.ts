// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { NewSeriesId, SeriesChange } from './series-edit.ts'
import type { Series } from './series.ts'
import type { StoredRows } from './stored-series.ts'

import { joinChange, newSeriesChange, removeChange } from './series-edit.ts'

/** The edits of the grid's *Series…* menu (SERIES-005). */
export type SelectionEdit = 'new' | 'add' | 'merge' | 'remove' | 'done'

/** The edits that change the photos' places, as against the one that marks a series. */
export type PlacingEdit = Exclude<SelectionEdit, 'done'>

/** Why an entry of the menu does not fit the selection. */
export type EntryBlock = 'tooFew' | 'noSeries' | 'noLoose' | 'noneInSeries' | 'manySeries'

/** One entry of the menu, and why it is disabled, if it is. */
export interface MenuEntry {
	readonly edit: SelectionEdit
	readonly blocked: EntryBlock | null
	/** Only *done*: the one series is done, so the entry reopens it. */
	readonly pressed?: boolean
}

/** The selection as the menu sees it: the series it touches, its photos in them and its loose photos. */
export interface SeriesOffer<P> {
	readonly selected: readonly P[]
	readonly touched: readonly Series<P>[]
	readonly inSeries: readonly P[]
	readonly loose: readonly P[]
}

/** A new series needs this many photos, as a series shows from two on (SERIES-001). */
const SERIES_MINIMUM = 2

/** Splits the selection by the series each photo is in. */
export function seriesOffer<P>(selected: readonly P[], seriesOf: ReadonlyMap<P, Series<P>>): SeriesOffer<P> {
	const inSeries = selected.filter((picture) => seriesOf.has(picture))
	const touched = [...new Set(inSeries.map((picture) => seriesOf.get(picture)!))]
	return { selected, touched, inSeries, loose: selected.filter((picture) => !seriesOf.has(picture)) }
}

/** The entries the menu offers, in order: a merge or an add first once a photo is in a series (SERIES-005, Grid). */
export function menuEntries<P>({ selected, touched, inSeries, loose }: SeriesOffer<P>): MenuEntry[] {
	const made: MenuEntry = { edit: 'new', blocked: selected.length < SERIES_MINIMUM ? 'tooFew' : null }
	const joined: MenuEntry = touched.length > 1
		? { edit: 'merge', blocked: null }
		: { edit: 'add', blocked: touched.length === 0 ? 'noSeries' : loose.length === 0 ? 'noLoose' : null }
	const removed: MenuEntry = { edit: 'remove', blocked: inSeries.length === 0 ? 'noneInSeries' : null }
	const marked: MenuEntry = { edit: 'done', blocked: touched.length === 0 ? 'noSeries' : touched.length > 1 ? 'manySeries' : null, pressed: touched.length === 1 && touched[0]!.stored?.status === 'done' }
	return touched.length === 0 ? [made, joined, removed, marked] : [joined, made, removed, marked]
}

/** What an edit of the selection writes, the photos its toast names and how many series it touched. */
export function selectionChange(edit: PlacingEdit, offer: SeriesOffer<Picture<ListingEntry>>, rows: StoredRows, newId: NewSeriesId): { pictures: readonly Picture<ListingEntry>[], change: SeriesChange, series: number } {
	const { selected, touched, inSeries, loose } = offer
	const series = touched.length
	switch (edit) {
		case 'new':
			return { pictures: selected, change: newSeriesChange(touched, selected, rows, newId), series }
		case 'add':
			return { pictures: loose, change: joinChange(touched, loose, rows, newId), series }
		case 'merge':
			return { pictures: [...touched.flatMap(({ members }) => members), ...loose], change: joinChange(touched, loose, rows, newId), series }
		case 'remove':
			return { pictures: inSeries, change: removeChange(touched, inSeries, rows, newId), series }
	}
}
