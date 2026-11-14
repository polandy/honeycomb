// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { memberIds } from './pairing.ts'

/** Whether a stored series is still open or marked done (ADR 0027, #183). */
export type SeriesStatus = 'open' | 'done'

/** A stored series as the lookup answers it: its members among the files asked for, and whether it has others (ADR 0027). */
export interface StoredSeries {
	readonly id: number
	readonly status: SeriesStatus
	readonly fileIds: readonly number[]
	readonly elsewhere: boolean
}

/** The series lookup's answer: the stored series and the kept-out files among the files asked for (ADR 0027). */
export interface SeriesLookup {
	readonly series: readonly StoredSeries[]
	readonly keptOut: readonly number[]
}

/** What a shown series carries from storage beside its members. */
export interface StoredSeriesInfo {
	readonly id: number
	readonly status: SeriesStatus
	readonly elsewhere: boolean
}

/** The stored row of each file the browser knows: its series, or null when it is kept out. */
export type StoredRows = ReadonlyMap<number, StoredSeriesInfo | null>

/** No stored rows: every picture is loose. */
export const NO_STORED_ROWS: StoredRows = new Map()

/** A stored series and its listed pictures, in listing order. */
export interface StoredGroup<P> {
	readonly info: StoredSeriesInfo
	readonly pictures: readonly P[]
}

/** The lookup's rows under those already known, which are newer. */
export function withLookup(known: StoredRows, answer: SeriesLookup): StoredRows {
	const read = new Map<number, StoredSeriesInfo | null>(answer.keptOut.map((fileId) => [fileId, null]))
	answer.series.forEach(({ id, status, elsewhere, fileIds }) => fileIds.forEach((fileId) => read.set(fileId, { id, status, elsewhere })))
	return new Map([...read, ...known])
}

/** The pictures in each stored series and the loose ones the automatic rule groups; kept-out pictures are in neither (SERIES-005.2). */
export function splitByStoredRows<P extends Picture<ListingEntry>>(pictures: readonly P[], rows: StoredRows): { stored: StoredGroup<P>[], loose: P[] } {
	const stored = new Map<number, { info: StoredSeriesInfo, pictures: P[] }>()
	const loose: P[] = []
	pictures.forEach((picture) => {
		const memberRows = memberIds(picture).map((fileId) => rows.get(fileId))
		const info = memberRows.find((row) => row !== undefined && row !== null)
		if (info) {
			const group = stored.get(info.id)
			if (group === undefined) {
				stored.set(info.id, { info, pictures: [picture] })
			} else {
				group.pictures.push(picture)
			}
		} else if (!memberRows.includes(null)) {
			loose.push(picture)
		}
	})
	return { stored: [...stored.values()], loose }
}
