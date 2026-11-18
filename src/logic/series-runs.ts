// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Series } from './series.ts'
import type { SeriesStatus } from './stored-series.ts'

/** A stretch of neighbouring pictures in one series: `first` up to but not including `end`. */
export interface SeriesRun<P> {
	readonly first: number
	readonly end: number
	readonly series: Series<P>
}

/** The part of a run one row of the grid shows, in columns `from` up to but not including `to`, and whether the run starts or ends there. */
export interface RowBracket<P> {
	readonly from: number
	readonly to: number
	readonly run: SeriesRun<P>
	readonly starts: boolean
	readonly ends: boolean
}

/** A tile's place in its series, on the first tile of a run the run's length, and the status of a stored series. */
export interface TileSeries<P> {
	readonly series: Series<P>
	readonly position: number
	readonly size: number
	readonly run: number | null
	readonly stored: SeriesStatus | null
}

/** The runs of neighbours sharing a series; a picture outside every series, another series or a group start in `breaks` ends a run (SERIES-002.12). */
export function seriesRuns<P>(pictures: readonly P[], seriesOf: ReadonlyMap<P, Series<P>>, breaks: readonly number[] = []): SeriesRun<P>[] {
	const groupStarts = new Set(breaks)
	const runs: SeriesRun<P>[] = []
	pictures.forEach((picture, index) => {
		const series = seriesOf.get(picture)
		if (series === undefined) {
			return
		}
		const last = runs.at(-1)
		if (last !== undefined && last.end === index && last.series.key === series.key && !groupStarts.has(index)) {
			runs[runs.length - 1] = { ...last, end: index + 1 }
		} else {
			runs.push({ first: index, end: index + 1, series })
		}
	})
	return runs
}

/** Each picture index's run, undefined outside every run. */
export function runsAt<P>(runs: readonly SeriesRun<P>[], count: number): (SeriesRun<P> | undefined)[] {
	const at: (SeriesRun<P> | undefined)[] = Array.from({ length: count })
	for (const run of runs) {
		at.fill(run, run.first, run.end)
	}
	return at
}

/** The brackets of the row holding the `count` pictures from `first` on. */
export function rowBrackets<P>(at: readonly (SeriesRun<P> | undefined)[], first: number, count: number): RowBracket<P>[] {
	const brackets: RowBracket<P>[] = []
	for (let column = 0; column < count; column++) {
		const run = at[first + column]
		if (run === undefined) {
			continue
		}
		const to = Math.min(count, run.end - first)
		brackets.push({ from: column, to, run, starts: run.first === first + column, ends: run.end === first + to })
		column = to - 1
	}
	return brackets
}

/** The series of the tile at the index, or null outside every series (SERIES-002.10). */
export function tileSeries<P>(at: readonly (SeriesRun<P> | undefined)[], index: number, picture: P): TileSeries<P> | null {
	const run = at[index]
	if (run === undefined) {
		return null
	}
	const { members } = run.series
	return { series: run.series, position: members.indexOf(picture) + 1, size: members.length, run: run.first === index ? run.end - run.first : null, stored: run.series.stored?.status ?? null }
}

/** The first index of the next run, or of the run before the focused one's, null at either end (SERIES-002.15). */
export function seriesJump<P>(runs: readonly SeriesRun<P>[], at: readonly (SeriesRun<P> | undefined)[], index: number, direction: 'previous' | 'next'): number | null {
	if (direction === 'next') {
		return runs.find((run) => run.first > index)?.first ?? null
	}
	const limit = at[index]?.first ?? index
	return runs.findLast((run) => run.first < limit)?.first ?? null
}
