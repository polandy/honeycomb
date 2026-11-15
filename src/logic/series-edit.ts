// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { Series } from './series.ts'
import type { SeriesStatus, StoredRows, StoredSeriesInfo } from './stored-series.ts'

import { memberIds } from './pairing.ts'

/** Where a file stands: in a stored series, kept out of every automatic series, or loose. */
export type SeriesPlace = StoredSeriesInfo | 'keptOut' | 'loose'

/** One file's place, as an edit writes it. */
export interface SeriesRow {
	readonly fileId: number
	readonly place: SeriesPlace
}

/** The rows an edit writes, and the rows it replaced, which undo writes back. */
export interface SeriesChange {
	readonly after: readonly SeriesRow[]
	readonly before: readonly SeriesRow[]
}

/** The series edits of the series compare (SERIES-005.10, SERIES-005.13). */
export type SeriesEdit = 'remove' | 'dissolve'

/** The body of the series write (ADR 0027); a null id makes a new series. */
export interface SeriesWrite {
	readonly series: readonly { readonly id: number | null, readonly status: SeriesStatus, readonly fileIds: readonly number[] }[]
	readonly keptOut: readonly number[]
	readonly released: readonly number[]
}

/** Where the file stands in the rows. */
export function placeOf(rows: StoredRows, fileId: number): SeriesPlace {
	const row = rows.get(fileId)
	return row === undefined ? 'loose' : row ?? 'keptOut'
}

/** The change that writes `place` for each file, remembering where each stood. */
function changeTo(rows: StoredRows, after: readonly SeriesRow[]): SeriesChange {
	return { after, before: after.map(({ fileId }) => ({ fileId, place: placeOf(rows, fileId) })) }
}

/** Takes the picture out of the series and keeps it out; an automatic series is first stored with its other shown members under `newId` (SERIES-005.10). */
export function removeChange(series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>, rows: StoredRows, newId: number): SeriesChange {
	const rest: SeriesRow[] = series.stored === undefined
		? series.members.filter((member) => member !== picture).flatMap(memberIds).map((fileId) => ({ fileId, place: { id: newId, status: 'open', elsewhere: false } }))
		: []
	return changeTo(rows, [...rest, ...memberIds(picture).map((fileId) => ({ fileId, place: 'keptOut' as const }))])
}

/** Keeps out every member of the series, for a stored series also its hidden and unlisted rows the browser knows (SERIES-005.13). */
export function dissolveChange(series: Series<Picture<ListingEntry>>, rows: StoredRows): SeriesChange {
	const stored = series.stored === undefined ? [] : [...rows].filter(([, info]) => info?.id === series.stored!.id).map(([fileId]) => fileId)
	const fileIds = new Set([...series.members.flatMap(memberIds), ...stored])
	return changeTo(rows, [...fileIds].map((fileId) => ({ fileId, place: 'keptOut' })))
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
