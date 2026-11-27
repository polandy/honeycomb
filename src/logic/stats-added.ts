// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'
import type { FolderRow } from './folder-row.ts'
import type { Counter } from './statistics.ts'
import type { PeriodBar } from './stats-period.ts'

import { METRIC, periodSums } from './statistics.ts'

/** A period's intake against its clean-up: photos added, pictures decided and pictures deleted (STATS-001.83). */
export interface PeriodIntake {
	readonly added: number
	readonly decided: number
	readonly deleted: number
}

/** The photos added of every library folder as one counter a day, in day order (STATS-001.81, ADR 0062). */
export function addedCounters(rows: readonly FolderRow[]): Counter[] {
	const byDay = new Map<string, number>()
	rows.forEach((row) => row.shotDays.forEach((each) => byDay.set(each.day, (byDay.get(each.day) ?? 0) + each.photos)))
	return [...byDay.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([day, value]) => ({ day, metric: METRIC.photosAdded, value }))
}

/** The bars with each one's photos added among its sums; whether a bar was counted stays (STATS-001.81). */
export function withAdded(bars: readonly PeriodBar[], added: readonly Counter[]): PeriodBar[] {
	return bars.map((bar) => {
		const value = periodSums(added, bar.range)(METRIC.photosAdded)
		return value === 0 ? bar : { ...bar, sums: { ...bar.sums, [METRIC.photosAdded]: value } }
	})
}

/** The intake line of a period; null for a period without photos added (STATS-001.83). */
export function periodIntake(counters: readonly Counter[], added: readonly Counter[], range: DayRange): PeriodIntake | null {
	const addedSum = periodSums(added, range)(METRIC.photosAdded)
	if (addedSum === 0) {
		return null
	}
	const sum = periodSums(counters, range)
	return { added: addedSum, decided: sum(METRIC.decided), deleted: sum(METRIC.trashPictures) + sum(METRIC.deletedPictures) }
}
