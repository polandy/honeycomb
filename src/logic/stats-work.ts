// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'
import type { Counter } from './statistics.ts'

import { METRIC, periodSums } from './statistics.ts'

/** The parts the space freed is made of, in the order of the bar (STATS-001.78). */
export type CleanUpPart = 'trash' | 'deleted' | 'raws'

/** One part of the space freed: its pictures or RAW files, its bytes and its whole percent of the bytes. */
export interface CleanUpRow {
	readonly part: CleanUpPart
	readonly count: number
	readonly bytes: number
	readonly share: number
}

/** The space freed in a period and what it is made of. */
export interface CleanUp {
	readonly freedBytes: number
	readonly rows: readonly CleanUpRow[]
}

/** The counters *Work done* lists, in its order (STATS-001.79). */
export type WorkKey = 'sidecarsCreated' | 'sidecarsUpdated' | 'ratingsSet' | 'colourLabelsSet' | 'tagsSet' | 'seriesDone' | 'foldersDone' | 'picturesMoved'

/** One row of *Work done*; `foreign` is the part of the sidecars updated from digiKam or darktable. */
export interface WorkRow {
	readonly key: WorkKey
	readonly value: number
	readonly foreign: number
}

const PERCENT = 100
const WORK_METRICS: readonly (readonly [WorkKey, string])[] = [
	['sidecarsCreated', METRIC.sidecarsCreated],
	['sidecarsUpdated', METRIC.sidecarsUpdated],
	['ratingsSet', METRIC.ratingsSet],
	['colourLabelsSet', METRIC.colourLabelsSet],
	['tagsSet', METRIC.tagsSet],
	['seriesDone', METRIC.seriesDone],
	['foldersDone', METRIC.foldersDone],
	['picturesMoved', METRIC.picturesMoved],
]

/** The space freed in the days of `range` by part, a part without a count and bytes left out (STATS-001.78). */
export function cleanUp(counters: readonly Counter[], range: DayRange): CleanUp {
	const sums = periodSums(counters, range)
	const parts: readonly (readonly [CleanUpPart, number, number])[] = [
		['trash', sums(METRIC.trashPictures), sums(METRIC.trashBytes)],
		['deleted', sums(METRIC.deletedPictures), sums(METRIC.deletedBytes)],
		['raws', sums(METRIC.rawsRemoved), sums(METRIC.rawsRemovedBytes)],
	]
	const freedBytes = parts.reduce((total, [, , bytes]) => total + bytes, 0)
	return {
		freedBytes,
		rows: parts
			.filter(([, count, bytes]) => count > 0 || bytes > 0)
			.map(([part, count, bytes]) => ({ part, count, bytes, share: freedBytes === 0 ? 0 : Math.round(bytes * PERCENT / freedBytes) })),
	}
}

/** What was done in the days of `range` besides deciding, a row at zero left out (STATS-001.79). */
export function workDone(counters: readonly Counter[], range: DayRange): readonly WorkRow[] {
	const sums = periodSums(counters, range)
	return WORK_METRICS
		.map(([key, metric]) => ({ key, value: sums(metric), foreign: key === 'sidecarsUpdated' ? sums(METRIC.sidecarsForeign) : 0 }))
		.filter((row) => row.value > 0)
}
