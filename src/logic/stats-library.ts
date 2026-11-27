import type { LibraryProgress } from './folder-progress.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'
import type { Counter, StatsAnswer } from './statistics.ts'

import { addDays, dayCount } from './days.ts'
import { folderProgress } from './folder-progress.ts'
import { METRIC, periodSums } from './statistics.ts'

/** The days of the pace the forecast reads, today included (STATS-001.84). */
export const FORECAST_DAYS = 90
const WEEK_DAYS = 7
const MONTH_DAYS = 30
/** From these many days on the rest is named in weeks, then in months. */
const WEEKS_FROM = 14
const MONTHS_FROM = 120

/** The rest at the net pace: how long, or that the backlog grows (STATS-001.84). */
export type Forecast = { readonly kind: 'grows' } | { readonly kind: 'days' | 'weeks' | 'months', readonly count: number }

/** What the *Library progress* card shows (STATS-001.42, STATS-001.84, STATS-001.85). */
export interface LibraryCard {
	readonly progress: LibraryProgress
	readonly undecided: number
	/** Null without a pace or without a photo undecided. */
	readonly forecast: Forecast | null
	/** The RAW bytes in folders marked done: at most this much a *Remove RAWs* could free. */
	readonly doneRawBytes: number
}

/** The library card of the rows below `roots`, its month and pace from the answer's today; `added` are the photos added a day. */
export function libraryCard(rows: readonly FolderRow[], roots: readonly string[], answer: Pick<StatsAnswer, 'counters' | 'today' | 'firstDay'>, added: readonly Counter[]): LibraryCard {
	const below = rows.filter((row) => roots.includes(row.root))
	const undecided = below.reduce((total, row) => total + row.undecided, 0)
	return {
		progress: folderProgress(below, roots, new Date(`${answer.today}T00:00:00Z`)),
		undecided,
		forecast: undecided === 0 ? null : forecast(undecided, answer, added),
		doneRawBytes: below.filter((row) => row.done !== null).reduce((total, row) => total + row.rawBytes, 0),
	}
}

/** The rest of `undecided` photos at the last 90 days' pictures decided less their photos added a day. */
function forecast(undecided: number, answer: Pick<StatsAnswer, 'counters' | 'today' | 'firstDay'>, added: readonly Counter[]): Forecast | null {
	if (answer.firstDay === null) {
		return null
	}
	const start = addDays(answer.today, 1 - FORECAST_DAYS)
	const range = { from: answer.firstDay > start ? answer.firstDay : start, to: answer.today }
	const decided = periodSums(answer.counters, range)(METRIC.decided)
	if (decided <= 0) {
		return null
	}
	const net = (decided - periodSums(added, range)(METRIC.photosAdded)) / dayCount(range)
	if (net <= 0) {
		return { kind: 'grows' }
	}
	const days = Math.ceil(undecided / net)
	if (days < WEEKS_FROM) {
		return { kind: 'days', count: days }
	}
	return days < MONTHS_FROM ? { kind: 'weeks', count: Math.round(days / WEEK_DAYS) } : { kind: 'months', count: Math.round(days / MONTH_DAYS) }
}
