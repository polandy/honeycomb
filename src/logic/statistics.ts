// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'

import { addDays } from './days.ts'

/** The metric keys the statistics page reads (STATS-001, ADR 0039). */
export const METRIC = {
	decided: 'pictures_decided',
	trashPictures: 'trash_pictures',
	trashBytes: 'trash_bytes',
	deletedPictures: 'deleted_pictures',
	deletedBytes: 'deleted_bytes',
	rawsRemoved: 'raws_removed',
	rawsRemovedBytes: 'raws_removed_bytes',
	sidecarsCreated: 'sidecars_created',
	sidecarsUpdated: 'sidecars_updated',
	sidecarsForeign: 'sidecars_foreign',
	seriesDone: 'series_done',
	foldersDone: 'folders_done',
	activeSeconds: 'active_seconds',
} as const

/** One daily counter of the user. */
export interface Counter {
	readonly day: string
	readonly metric: string
	readonly value: number
}

/** The cached XMP readings of the user that were read: how many, and how many of them are picked, rejected and rated (STATS-001.45). */
export interface ReadPictures {
	readonly pictures: number
	readonly picked: number
	readonly rejected: number
	readonly rated: number
}

/** What the stats API answers: every counter, the first counted day, the user's today and what began before the counting. */
export interface StatsAnswer {
	readonly counters: readonly Counter[]
	readonly firstDay: string | null
	readonly today: string
	readonly seriesDoneBefore: number
	readonly read: ReadPictures
}

const PERCENT = 100
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/** The sum of a metric over the days of the range. */
export function periodSums(counters: readonly Counter[], range: DayRange): (metric: string) => number {
	const sums = new Map<string, number>()
	counters.filter((each) => each.day >= range.from && each.day <= range.to).forEach((each) => sums.set(each.metric, (sums.get(each.metric) ?? 0) + each.value))
	return (metric) => sums.get(metric) ?? 0
}

/** The whole percent `now` differs from `before`, or null without numbers before. */
export function percentChange(now: number, before: number): number | null {
	return before === 0 ? null : Math.round(((now - before) / before) * PERCENT)
}

/** The current run of active days up to today or yesterday, and the longest run (STATS-001.22). */
export function streak(counters: readonly Counter[], today: string): { current: number, longest: number } {
	const days = [...new Set(counters.filter((each) => each.value > 0).map((each) => each.day))].sort()
	let run = 0
	let longest = 0
	days.forEach((day, index) => {
		run = index > 0 && addDays(days[index - 1]!, 1) === day ? run + 1 : 1
		longest = Math.max(longest, run)
	})
	const last = days.at(-1)
	return { current: last === today || last === addDays(today, -1) ? run : 0, longest }
}

/** The well-formed counters of an answer, the rest dropped. */
export function parseCounters(answer: unknown): Counter[] {
	return Array.isArray(answer) ? answer.filter(isCounter) : []
}

/** The read pictures of an answer, a missing or malformed number as zero. */
export function parseReadPictures(answer: unknown): ReadPictures {
	const fields = typeof answer === 'object' && answer !== null ? answer as Record<string, unknown> : {}
	const count = (key: string): number => Number.isInteger(fields[key]) ? fields[key] as number : 0
	return { pictures: count('pictures'), picked: count('picked'), rejected: count('rejected'), rated: count('rated') }
}

/** The whole percent of the read pictures picked, rejected, unflagged and rated; null while none was read (STATS-001.45). */
export function readShares(read: ReadPictures): { picked: number, rejected: number, unflagged: number, rated: number } | null {
	if (read.pictures === 0) {
		return null
	}
	const percent = (part: number): number => Math.round((part * PERCENT) / read.pictures)
	return { picked: percent(read.picked), rejected: percent(read.rejected), unflagged: percent(read.pictures - read.picked - read.rejected), rated: percent(read.rated) }
}

/** Whether a value is a well-formed counter. */
function isCounter(value: unknown): value is Counter {
	if (typeof value !== 'object' || value === null) {
		return false
	}
	const { day, metric, value: count } = value as Record<string, unknown>
	return typeof day === 'string' && DAY_PATTERN.test(day) && typeof metric === 'string' && Number.isInteger(count)
}
