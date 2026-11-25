// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../logic/decision.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { Series } from '../logic/series.ts'

import { computed } from 'vue'
import { isRejected } from '../logic/decision.ts'
import { rowBrackets, runsAt, seriesJump, seriesRuns, tileSeries } from '../logic/series-runs.ts'

/** What the grid knows of the series: every picture's series, the offered ones' keys and the pictures that may still change. */
export interface GridSeriesSource<P> {
	pictures: () => readonly P[]
	seriesOf: () => ReadonlyMap<P, Series<P>> | undefined
	offered: () => ReadonlySet<PictureId> | undefined
	open: () => ReadonlySet<P> | undefined
	groupStarts: () => readonly number[]
	/** A rejected picture between two of a series' pictures stays inside its bracket. */
	decisionOf: (picture: P) => Decision
}

/** A bracket element's key, classes and place in its row. */
export interface BracketAttributes {
	readonly key: number
	readonly class: Readonly<Record<string, boolean>>
	readonly style: { readonly left: string, readonly width: string }
}

/** The grid's series runs, computed once per layout, with the brackets of a row, a tile's badge and the series jump (SERIES-002.12). */
export function useGridSeries<P>(source: GridSeriesSource<P>) {
	const runs = computed(() => seriesRuns(source.pictures(), source.seriesOf() ?? new Map<P, Series<P>>(), source.groupStarts(), (picture) => isRejected(source.decisionOf(picture))))
	const at = computed(() => runsAt(runs.value, source.pictures().length))
	const settled = (series: Series<P>) => source.offered()?.has(series.key) !== true
	const isOpen = (picture: P) => source.open()?.has(picture) === true

	/** The bracket elements' attributes for the row holding the `count` pictures from `first` on, tiles `pitch` apart with `gap` between. */
	function brackets(first: number, count: number, pitch: number, gap: number): BracketAttributes[] {
		return rowBrackets(at.value, first, count).map(({ from, to, run, starts, ends }) => ({
			key: run.first,
			class: { 'photo-grid__bracket': true, 'photo-grid__bracket--start': starts, 'photo-grid__bracket--end': ends, 'photo-grid__bracket--settled': settled(run.series), 'photo-grid__bracket--open': isOpen(run.series.members[0]!) },
			style: { left: `${from * pitch}px`, width: `${(to - from) * pitch - gap}px` },
		}))
	}

	/** The series props of the tile at the index. */
	function tileProps(index: number, picture: P) {
		const series = tileSeries(at.value, index, picture)
		return { series, seriesSettled: series !== null && settled(series.series), seriesOpen: isOpen(picture) }
	}

	return {
		brackets,
		tileProps,
		/** The index the focus jumps to from `index`, null at either end (SERIES-002.15). */
		jump: (index: number, direction: 'previous' | 'next') => seriesJump(runs.value, at.value, index, direction),
	}
}
