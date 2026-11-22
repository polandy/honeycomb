// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { picturesPerMinute } from './active-time.ts'

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

/** The periods the page sums over (STATS-001.21). */
export type Period = 'week' | 'month' | 'year' | 'all'

/** The days from `from` to `to`, both included, as `YYYY-MM-DD`. */
export interface DayRange {
	readonly from: string
	readonly to: string
}

/** One bar: the pictures decided and moved to the trash bin in its days. */
export interface Bar {
	readonly range: DayRange
	readonly decided: number
	readonly trashed: number
}

/** The numbers of one period: the tiles, the line below them and the bars. */
export interface PeriodNumbers {
	/** The days of the period, both ends included. */
	readonly days: number
	readonly decided: number
	readonly decidedChange: number | null
	readonly trashed: number
	readonly freedBytes: number
	readonly deletedForGood: number
	readonly sidecarsCreated: number
	readonly sidecarsUpdated: number
	readonly sidecarsForeign: number
	readonly activeMs: number
	readonly perMinute: number | null
	readonly seriesDone: number
	readonly rawsRemoved: number
	readonly bars: readonly Bar[]
}

const DAY_MS = 86_400_000
const SECOND_MS = 1000
const WEEK_DAYS = 7
const MONTH_DAYS = 30
const PERCENT = 100
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/
const DAY_LENGTH = 'YYYY-MM-DD'.length

/** The `YYYY-MM-DD` day of a UTC time in ms. */
function dayOf(ms: number): string {
	return new Date(ms).toISOString().slice(0, DAY_LENGTH)
}

/** The day `days` after `day` (before, when negative). */
function addDays(day: string, days: number): string {
	return dayOf(Date.parse(day) + days * DAY_MS)
}

/** The days from `from` to `to`, both included. */
function dayCount(range: DayRange): number {
	return Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1
}

/** The last day of the calendar month of `day`. */
function monthEnd(day: string): string {
	const date = new Date(day)
	return dayOf(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

/** The range of a period ending today; all time starts at the first counted day, or today without one. */
export function periodRange(period: Period, today: string, firstDay: string | null): DayRange {
	const from = {
		week: () => addDays(today, 1 - WEEK_DAYS),
		month: () => addDays(today, 1 - MONTH_DAYS),
		year: () => `${today.slice(0, 4)}-01-01`,
		all: () => firstDay ?? today,
	}[period]()
	return { from, to: today }
}

/** The range of the same length that ends the day before `range` (STATS-001.41). */
export function rangeBefore(range: DayRange): DayRange {
	return { from: addDays(range.from, -dayCount(range)), to: addDays(range.from, -1) }
}

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

/** The ranges of the bars: days for 7 days, 7 days each ending today for 30, calendar months else. */
function barRanges(period: Period, range: DayRange): DayRange[] {
	const ranges: DayRange[] = []
	if (period === 'month') {
		for (let to = range.to; to >= range.from; to = addDays(to, -WEEK_DAYS)) {
			const from = addDays(to, 1 - WEEK_DAYS)
			ranges.unshift({ from: from < range.from ? range.from : from, to })
		}
		return ranges
	}
	const end = period === 'week' ? (day: string) => day : monthEnd
	for (let from = range.from; from <= range.to; from = addDays(end(from), 1)) {
		const to = end(from)
		ranges.push({ from, to: to > range.to ? range.to : to })
	}
	return ranges
}

/** The bars of a period, oldest first (STATS-001.21). */
export function periodBars(counters: readonly Counter[], period: Period, range: DayRange): Bar[] {
	return barRanges(period, range).map((barRange) => {
		const sums = periodSums(counters, barRange)
		return { range: barRange, decided: sums(METRIC.decided), trashed: sums(METRIC.trashPictures) }
	})
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

/** The numbers of a period ending today, with pictures decided compared to the period before (STATS-001.41). */
export function periodNumbers(counters: readonly Counter[], period: Period, today: string, firstDay: string | null): PeriodNumbers {
	const range = periodRange(period, today, firstDay)
	const sums = periodSums(counters, range)
	const decided = sums(METRIC.decided)
	const activeMs = sums(METRIC.activeSeconds) * SECOND_MS
	return {
		days: dayCount(range),
		decided,
		decidedChange: period === 'all' ? null : percentChange(decided, periodSums(counters, rangeBefore(range))(METRIC.decided)),
		trashed: sums(METRIC.trashPictures),
		freedBytes: sums(METRIC.trashBytes) + sums(METRIC.deletedBytes),
		deletedForGood: sums(METRIC.deletedPictures),
		sidecarsCreated: sums(METRIC.sidecarsCreated),
		sidecarsUpdated: sums(METRIC.sidecarsUpdated),
		sidecarsForeign: sums(METRIC.sidecarsForeign),
		activeMs,
		perMinute: picturesPerMinute(decided, activeMs),
		seriesDone: sums(METRIC.seriesDone),
		rawsRemoved: sums(METRIC.rawsRemoved),
		bars: periodBars(counters, period, range),
	}
}
