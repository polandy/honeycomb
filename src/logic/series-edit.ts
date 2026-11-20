// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'
import type { Series } from './series.ts'
import type { SeriesStatus, StoredRows, StoredSeriesInfo } from './stored-series.ts'

import { memberIds } from './pairing.ts'

/** Where a file stands: in a stored series, kept out of every automatic series, or loose. */
export type SeriesPlace = StoredSeriesInfo | 'keptOut' | 'loose'

/** One file's place, as an edit writes it. */
export interface SeriesRow {
	readonly fileId: PictureId
	readonly place: SeriesPlace
}

/** The rows an edit writes, and the rows it replaced, which undo writes back. */
export interface SeriesChange {
	readonly after: readonly SeriesRow[]
	readonly before: readonly SeriesRow[]
}

/** The series edits: the series compare's (SERIES-005.10, .13–.15) and the grid's (SERIES-005.4–.7, .11). */
export type SeriesEdit = 'new' | 'add' | 'merge' | 'remove' | 'dissolve' | 'done' | 'reopen'

/** Hands out a local id for each new series. */
export type NewSeriesId = () => number

/** The body of the series write (ADR 0027); a null id makes a new series. */
export interface SeriesWrite {
	readonly series: readonly { readonly id: number | null, readonly status: SeriesStatus, readonly fileIds: readonly number[] }[]
	readonly keptOut: readonly number[]
	readonly released: readonly number[]
}

/** Where the file stands in the rows. */
export function placeOf(rows: StoredRows, fileId: PictureId): SeriesPlace {
	const row = rows.get(fileId)
	return row === undefined ? 'loose' : row ?? 'keptOut'
}

/** The change that writes `place` for each file, remembering where each stood. */
function changeTo(rows: StoredRows, after: readonly SeriesRow[]): SeriesChange {
	return { after, before: after.map(({ fileId }) => ({ fileId, place: placeOf(rows, fileId) })) }
}

/** The rows of each touched automatic series' members that stay, each series stored under its own new id (D3a). */
function restRows(touched: readonly Series<Picture<ListingEntry>>[], leaving: readonly Picture<ListingEntry>[], newId: NewSeriesId): SeriesRow[] {
	return touched.filter(({ stored }) => stored === undefined).flatMap(({ members }) => {
		const place: StoredSeriesInfo = { id: newId(), status: 'open', elsewhere: false }
		return members.filter((member) => !leaving.includes(member)).flatMap(memberIds).map((fileId) => ({ fileId, place }))
	})
}

/** The file ids of the series: of a stored series every listed row the browser knows, hidden ones too, of an automatic one its members. */
function seriesFileIds(series: Series<Picture<ListingEntry>>, rows: StoredRows): number[] {
	const stored = series.stored === undefined ? [] : [...rows].filter(([, info]) => info?.id === series.stored!.id).map(([fileId]) => fileId)
	return [...new Set([...series.members.flatMap(memberIds), ...stored])]
}

/** Takes the pictures out of their touched series and keeps them out; an automatic series is first stored with its other shown members (SERIES-005.10, .11). */
export function removeChange(touched: readonly Series<Picture<ListingEntry>>[], pictures: readonly Picture<ListingEntry>[], rows: StoredRows, newId: NewSeriesId): SeriesChange {
	return changeTo(rows, [...restRows(touched, pictures, newId), ...pictures.flatMap(memberIds).map((fileId) => ({ fileId, place: 'keptOut' as const }))])
}

/** Puts the pictures into a new series, taking them out of their touched series as `removeChange` does (SERIES-005.4, .5, .12). */
export function newSeriesChange(touched: readonly Series<Picture<ListingEntry>>[], pictures: readonly Picture<ListingEntry>[], rows: StoredRows, newId: NewSeriesId): SeriesChange {
	const rest = restRows(touched, pictures, newId)
	const place: StoredSeriesInfo = { id: newId(), status: 'open', elsewhere: false }
	return changeTo(rows, [...rest, ...pictures.flatMap(memberIds).map((fileId) => ({ fileId, place }))])
}

/** Joins the series and the loose pictures into one, under the first stored series' id; it is done only when every series was and nothing loose joins (SERIES-005.6, .7, .9, .16). */
export function joinChange(series: readonly Series<Picture<ListingEntry>>[], loose: readonly Picture<ListingEntry>[], rows: StoredRows, newId: NewSeriesId): SeriesChange {
	const target = series.find(({ stored }) => stored !== undefined)?.stored
	const done = loose.length === 0 && series.every(({ stored }) => stored?.status === 'done')
	const place: StoredSeriesInfo = { ...(target ?? { id: newId(), elsewhere: false }), status: done ? 'done' : 'open' }
	const fileIds = [...series.flatMap((each) => seriesFileIds(each, rows)), ...loose.flatMap(memberIds)]
	return changeTo(rows, fileIds.map((fileId) => ({ fileId, place })))
}

/** Marks the series done or open; an automatic series is stored under a new id first (SERIES-005.14, .15). */
export function statusChange(series: Series<Picture<ListingEntry>>, status: SeriesStatus, rows: StoredRows, newId: NewSeriesId): SeriesChange {
	const place: StoredSeriesInfo = { ...(series.stored ?? { id: newId(), elsewhere: false }), status }
	return changeTo(rows, seriesFileIds(series, rows).map((fileId) => ({ fileId, place })))
}

/** Keeps out every member of the series, for a stored series also its hidden and unlisted rows the browser knows (SERIES-005.13). */
export function dissolveChange(series: Series<Picture<ListingEntry>>, rows: StoredRows): SeriesChange {
	return changeTo(rows, seriesFileIds(series, rows).map((fileId) => ({ fileId, place: 'keptOut' })))
}

/** The rows with each written file in its new place. */
export function withSeriesRows(rows: StoredRows, written: readonly SeriesRow[]): StoredRows {
	const next = new Map(rows)
	written.forEach(({ fileId, place }) => {
		if (place === 'loose') {
			next.delete(fileId)
		} else {
			next.set(fileId, place === 'keptOut' ? null : place)
		}
	})
	return next
}

/** Whether two places are the same; series by id and status. */
function samePlace(a: SeriesPlace, b: SeriesPlace): boolean {
	return typeof a === 'string' || typeof b === 'string' ? a === b : a.id === b.id && a.status === b.status
}

/** Puts back the place in `before` of each unsaved file that still stands where the failed save put it (SERIES-005.19). */
export function revertSeriesRows(rows: StoredRows, unsaved: readonly SeriesRow[], before: StoredRows): StoredRows {
	const back = unsaved.filter(({ fileId, place }) => samePlace(placeOf(rows, fileId), place))
	return withSeriesRows(rows, back.map(({ fileId }) => ({ fileId, place: placeOf(before, fileId) })))
}

/** The rows with series `from` called `to`, once the server answered its id. */
export function renameSeries(rows: StoredRows, from: number, to: number): StoredRows {
	return new Map([...rows].map(([fileId, info]) => [fileId, info?.id === from ? { ...info, id: to } : info]))
}

/** The write of the rows, one item per series in order of first row, its newest status; `refs` holds each item's id before `resolve`. */
export function seriesWrite(rows: readonly SeriesRow[], resolve: (id: number) => number | null): { write: SeriesWrite, refs: number[] } {
	const series = new Map<number, { status: SeriesStatus, fileIds: number[] }>()
	const keptOut: number[] = []
	const released: number[] = []
	rows.forEach(({ fileId, place }) => {
		if (place === 'keptOut') {
			keptOut.push(fileId)
		} else if (place === 'loose') {
			released.push(fileId)
		} else {
			const item = series.get(place.id) ?? { status: place.status, fileIds: [] }
			item.status = place.status
			item.fileIds.push(fileId)
			series.set(place.id, item)
		}
	})
	const refs = [...series.keys()]
	return { write: { series: [...series].map(([id, item]) => ({ id: resolve(id), ...item })), keptOut, released }, refs }
}
