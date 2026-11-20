// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SeriesPlace, SeriesRow, SeriesWrite } from './logic/series-edit.ts'
import type { SeriesLookup } from './logic/stored-series.ts'

import { computed, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { memberIds } from './logic/pairing.ts'
import { byFileId, saveQueue } from './logic/save-queue.ts'
import { placeOf, renameSeries, revertSeriesRows, seriesWrite, withSeriesRows } from './logic/series-edit.ts'
import { NO_STORED_ROWS, withLookup } from './logic/stored-series.ts'

/** The series lookup endpoint (ADR 0027). */
export type LookupSeries = (fileIds: readonly number[]) => Promise<SeriesLookup>

/** The series write endpoint, answering each series' id in request order (ADR 0027). */
export type SaveSeries = (write: SeriesWrite) => Promise<{ ids: readonly number[] }>

/** The endpoints the stored series read and write through. */
export interface SeriesEndpoints {
	readonly lookupSeries: LookupSeries
	readonly saveSeries: SaveSeries
}

/** The stored series rows of the open cull (SERIES-005); `current` names the open cull, answers for another are dropped. */
export function useStoredSeries({ lookupSeries, saveSeries }: SeriesEndpoints, current: () => unknown) {
	const rows = shallowRef(NO_STORED_ROWS)
	const reads = shallowRef(0)
	/** Whether a read has not answered yet (SERIES-005.30). */
	const loading = computed(() => reads.value > 0)
	// A new series has a local id below 0 until the server answers its real one; a vanished id is answered anew.
	const answered = new Map<number, number>()
	let lastLocalId = 0
	const queue = saveQueue(send, { key: byFileId })

	/** Forgets the rows of the cull before. */
	function reset() {
		rows.value = NO_STORED_ROWS
	}

	/** Reads the rows of the files under those known, unless another cull opened meanwhile. */
	async function read(fileIds: readonly number[], failure: string) {
		const cull = current()
		reads.value++
		try {
			const answer = await lookupSeries(fileIds)
			if (current() === cull) {
				rows.value = withLookup(rows.value, answer)
			}
		} catch (error) {
			logger.error(failure, { error })
		} finally {
			reads.value--
		}
	}

	/** Reads the rows of every member of the opened pictures; a failed read leaves every series automatic (SERIES-005.26). */
	function load(opened: readonly Picture<ListingEntry>[]) {
		void read(opened.flatMap(memberIds), 'Could not read the stored series; every series shows as automatic')
	}

	/** Reads the rows of files put back that it holds none of. */
	function restore(fileIds: readonly number[]) {
		const unknown = fileIds.filter((fileId) => !rows.value.has(fileId))
		if (unknown.length > 0) {
			void read(unknown, 'Could not read the stored series of the photos moved back')
		}
	}

	/** A local id for a new series, until the server answers its real one. */
	function newId(): number {
		lastLocalId -= 1
		return lastLocalId
	}

	/** The newest id the series goes by. */
	function resolve(id: number): number {
		let resolved = id
		for (let next = answered.get(resolved); next !== undefined; next = answered.get(resolved)) {
			resolved = next
		}
		return resolved
	}

	/** The place with its series by its newest id. */
	function resolvedPlace(place: SeriesPlace): SeriesPlace {
		return typeof place === 'string' ? place : { ...place, id: resolve(place.id) }
	}

	const resolvedRow = ({ fileId, place }: SeriesRow): SeriesRow => ({ fileId, place: resolvedPlace(place) })

	/** Writes the rows and takes the ids the server answered for new or vanished series (SERIES-005.22). */
	async function send(queued: readonly SeriesRow[]) {
		const { write, refs } = seriesWrite(queued.map(resolvedRow), (id) => (id > 0 ? id : null))
		const { ids } = await saveSeries(write)
		refs.forEach((ref, index) => {
			const id = ids[index]
			if (id !== undefined && id !== ref) {
				answered.set(ref, id)
				rows.value = renameSeries(rows.value, ref, id)
			}
		})
	}

	/** Shows the rows at once and saves them; a failed save is logged and puts back what no later edit changed (SERIES-005.19). */
	async function store(written: readonly SeriesRow[]) {
		const cull = current()
		const resolved = written.map(resolvedRow)
		const before = new Map(resolved.flatMap(({ fileId }) => (rows.value.has(fileId) ? [[fileId, rows.value.get(fileId)!] as const] : [])))
		rows.value = withSeriesRows(rows.value, resolved)
		const result = await queue(resolved)
		if (!result.ok) {
			logger.error('Could not save the series', { error: result.error })
			if (current() === cull) {
				const back = [...before].map(([fileId]) => ({ fileId, place: resolvedPlace(placeOf(before, fileId)) }))
				rows.value = revertSeriesRows(rows.value, result.unsaved.map(resolvedRow), withSeriesRows(NO_STORED_ROWS, back))
			}
		}
	}

	return { rows, loading, reset, load, restore, newId, store }
}
