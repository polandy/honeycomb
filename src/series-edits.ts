// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { NewSeriesId } from './logic/series-edit.ts'
import type { SelectionEdit } from './logic/series-menu.ts'
import type { Series } from './logic/series.ts'
import type { SeriesStatus, StoredRows } from './logic/stored-series.ts'
import type { SeriesStep } from './logic/undo.ts'

import { dissolveChange, joinChange, removeChange, statusChange } from './logic/series-edit.ts'
import { selectionChange, seriesOffer } from './logic/series-menu.ts'
import { seriesStep } from './logic/undo.ts'

type P = Picture<ListingEntry>

/** What the series edits read from the cull and hand to it. */
export interface SeriesEditsContext {
	/** Records the step in the undo history and puts it into effect. */
	readonly record: (step: SeriesStep) => SeriesStep | null
	readonly rows: () => StoredRows
	readonly newId: NewSeriesId
	/** The series of each picture in one. */
	readonly seriesOf: () => ReadonlyMap<P, Series<P>>
}

/** The cull's series edits, each one undo step that it returns (SERIES-005). */
export function useSeriesEdits(context: SeriesEditsContext) {
	/** Takes the picture out of the series and keeps it out (SERIES-005.10). */
	function removeFromSeries(series: Series<P>, picture: P): SeriesStep | null {
		return context.record(seriesStep('remove', [picture], removeChange([series], [picture], context.rows(), context.newId), 1))
	}

	/** Keeps out every member of the series (SERIES-005.13). */
	function dissolveSeries(series: Series<P>): SeriesStep | null {
		return context.record(seriesStep('dissolve', series.members, dissolveChange(series, context.rows()), 1))
	}

	/** Merges the series, in capture-time order, into one under the first stored one's id (SERIES-005.8, .9). */
	function mergeSeries(series: readonly Series<P>[]): SeriesStep | null {
		return context.record(seriesStep('merge', series.flatMap(({ members }) => members), joinChange(series, [], context.rows(), context.newId), series.length))
	}

	/** Makes, adds to, merges or leaves series with the chosen pictures (SERIES-005.4–.7, .11). */
	function editSelection(edit: SelectionEdit, chosen: readonly P[]): SeriesStep | null {
		const { pictures, change, series } = selectionChange(edit, seriesOffer(chosen, context.seriesOf()), context.rows(), context.newId)
		return context.record(seriesStep(edit, pictures, change, series))
	}

	/** Marks the series done or reopens it (SERIES-005.14, .15). */
	function markSeries(series: Series<P>, status: SeriesStatus): SeriesStep | null {
		return context.record(seriesStep(status === 'done' ? 'done' : 'reopen', series.members, statusChange(series, status, context.rows(), context.newId), 1))
	}

	return { removeFromSeries, dissolveSeries, mergeSeries, editSelection, markSeries }
}
