// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'
import type { Counter } from './statistics.ts'

import { picturesPerMinute } from './active-time.ts'
import { METRIC, periodSums } from './statistics.ts'

/** The hero and the tiles of one period on the statistics page (STATS-001.59 to STATS-001.62). */
export interface Overview {
	readonly decided: number
	readonly picked: number
	readonly rejected: number
	readonly keepRate: number | null
	readonly activeDays: number
	readonly perActiveDay: number | null
	readonly spaceFreedBytes: number
	readonly picturesFreed: number
	readonly rawsRemoved: number
	readonly activeMs: number
	readonly pace: number | null
	readonly sidecarsCreated: number
	readonly sidecarsUpdated: number
	readonly sidecarsForeign: number
	readonly seriesDone: number
}

/** Which way a change of pictures decided points. */
export type ChangeDirection = 'more' | 'fewer' | 'same'

const SECOND_MS = 1000
const PERCENT = 100
/** The pace's steps in a whole: one decimal. */
export const PACE_STEPS = 10

/** The share of `part` in `whole` as a whole percent, null without a whole. */
const share = (part: number, whole: number): number | null => (whole === 0 ? null : Math.round(part * PERCENT / whole))

/** The hero and the tiles of the days of `range`: the keep rate of picked against rejected, the space freed with the RAW files removed, the pace (STATS-001.59 to STATS-001.62). */
export function periodOverview(counters: readonly Counter[], range: DayRange): Overview {
	const sums = periodSums(counters, range)
	const inRange = counters.filter((each) => each.day >= range.from && each.day <= range.to)
	const activeDays = new Set(inRange.filter((each) => each.value > 0).map((each) => each.day)).size
	const decided = sums(METRIC.decided)
	const picked = sums(METRIC.picked)
	const rejected = sums(METRIC.rejected)
	const activeMs = sums(METRIC.activeSeconds) * SECOND_MS
	const perMinute = picturesPerMinute(decided, activeMs)
	return {
		decided,
		picked,
		rejected,
		keepRate: share(picked, picked + rejected),
		activeDays,
		perActiveDay: activeDays === 0 ? null : Math.round(decided / activeDays),
		spaceFreedBytes: sums(METRIC.trashBytes) + sums(METRIC.deletedBytes) + sums(METRIC.rawsRemovedBytes),
		picturesFreed: sums(METRIC.trashPictures) + sums(METRIC.deletedPictures),
		rawsRemoved: sums(METRIC.rawsRemoved),
		activeMs,
		pace: perMinute === null ? null : Math.round(perMinute * PACE_STEPS) / PACE_STEPS,
		sidecarsCreated: sums(METRIC.sidecarsCreated),
		sidecarsUpdated: sums(METRIC.sidecarsUpdated),
		sidecarsForeign: sums(METRIC.sidecarsForeign),
		seriesDone: sums(METRIC.seriesDone),
	}
}

/** More above zero, fewer below, the same at zero (STATS-001.41). */
export function changeDirection(change: number): ChangeDirection {
	return change > 0 ? 'more' : change < 0 ? 'fewer' : 'same'
}
