// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'
import type { Counter } from './statistics.ts'

import { picturesPerMinute } from './active-time.ts'
import { addDays, dayCount, monthEnd, monthStart, weekDay, yearOf, yearRange } from './days.ts'
import { METRIC, percentChange, periodSums, streak } from './statistics.ts'

/** The granularities of the statistics page's segment (STATS-001.21). */
export type PeriodKind = 'week' | 'month' | 'year' | 'all'

/** One calendar period: a week, month or year, or all time; its range runs past today in the period of today. */
export interface Period {
	readonly kind: PeriodKind
	readonly range: DayRange
}

/** What every period depends on: the user's today, the first counted day and the locale's first day of the week, 0 for Sunday. */
export interface PeriodBounds {
	readonly today: string
	readonly firstDay: string | null
	readonly firstWeekDay: number
}

/** One step back or forward. */
export type Step = -1 | 1

/** What one bar covers. */
export type BarUnit = 'day' | 'month' | 'year'

/** One bar: the pictures decided and moved to the trash bin in its days, and whether it lies after today, before the first counted day or holds today. */
export interface PeriodBar {
	readonly range: DayRange
	readonly decided: number
	readonly trashed: number
	readonly future: boolean
	readonly beforeFirst: boolean
	readonly today: boolean
}

/** The days pictures decided are compared with; `whole` when they are the whole period before. */
export interface Compared {
	readonly range: DayRange
	readonly whole: boolean
}

/** The numbers of one period: the tiles, the line below them and the bars. */
export interface PeriodNumbers {
	readonly decided: number
	readonly decidedChange: number | null
	readonly compared: Compared | null
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
	readonly unit: BarUnit
	readonly bars: readonly PeriodBar[]
}

const WEEK_DAYS = 7
const SECOND_MS = 1000

/** The first day stepping may reach: the first counted day, or today without one. */
const firstOf = (bounds: PeriodBounds): string => bounds.firstDay ?? bounds.today
const holds = (range: DayRange, day: string): boolean => range.from <= day && day <= range.to

/** The period of `kind` that holds `day`; all time runs from the first counted day to today (STATS-001.21, STATS-001.53). */
export function periodAt(kind: PeriodKind, day: string, bounds: PeriodBounds): Period {
	const range = {
		week: () => {
			const from = addDays(day, -((weekDay(day) - bounds.firstWeekDay + WEEK_DAYS) % WEEK_DAYS))
			return { from, to: addDays(from, WEEK_DAYS - 1) }
		},
		month: () => ({ from: monthStart(day), to: monthEnd(day) }),
		year: () => yearRange(yearOf(day)),
		all: () => ({ from: firstOf(bounds), to: bounds.today }),
	}[kind]()
	return { kind, range }
}

/** Whether the period holds today. */
export function holdsToday(period: Period, today: string): boolean {
	return holds(period.range, today)
}

/** Whether a step leaves neither the period of today nor that of the first counted day; all time never steps (STATS-001.52). */
export function canStep(period: Period, step: Step, bounds: PeriodBounds): boolean {
	if (period.kind === 'all') {
		return false
	}
	return step < 0 ? period.range.from > firstOf(bounds) : period.range.to < bounds.today
}

/** The day a step lands on: the first day of the period before or after, not before the first counted day (STATS-001.52). */
export function stepAnchor(period: Period, step: Step, bounds: PeriodBounds): string {
	const day = periodAt(period.kind, step < 0 ? addDays(period.range.from, -1) : addDays(period.range.to, 1), bounds).range.from
	const first = firstOf(bounds)
	return day < first ? first : day
}

/** The period before, in the period of today only up to the same day; null for all time (STATS-001.41). */
export function comparedRange(period: Period, bounds: PeriodBounds): Compared | null {
	if (period.kind === 'all') {
		return null
	}
	const before = periodAt(period.kind, addDays(period.range.from, -1), bounds).range
	if (!holdsToday(period, bounds.today)) {
		return { range: before, whole: true }
	}
	const to = addDays(before.from, dayCount({ from: period.range.from, to: bounds.today }) - 1)
	return { range: { from: before.from, to: to < before.to ? to : before.to }, whole: false }
}

/** The ranges from `range.from` on, each ending at `end` of its first day, until one reaches past `range.to`. */
function split(range: DayRange, end: (day: string) => string): DayRange[] {
	const ranges: DayRange[] = []
	for (let from = range.from; from <= range.to; from = addDays(end(from), 1)) {
		ranges.push({ from, to: end(from) })
	}
	return ranges
}

/** Days for a week and a month, months for a year, years for all time from two calendar years on, months before. */
function barRanges(period: Period): { unit: BarUnit, ranges: DayRange[] } {
	const { kind, range } = period
	if (kind === 'week' || kind === 'month') {
		return { unit: 'day', ranges: split(range, (day) => day) }
	}
	if (kind === 'year' || yearOf(range.from) === yearOf(range.to)) {
		return { unit: 'month', ranges: split({ from: monthStart(range.from), to: range.to }, monthEnd) }
	}
	return { unit: 'year', ranges: split({ from: yearRange(yearOf(range.from)).from, to: range.to }, (day) => yearRange(yearOf(day)).to) }
}

/** The bars of a period, oldest first, with the slots after today and before the first counted day marked (STATS-001.21, STATS-001.54). */
export function periodBars(counters: readonly Counter[], period: Period, bounds: PeriodBounds): { unit: BarUnit, bars: PeriodBar[] } {
	const { unit, ranges } = barRanges(period)
	const bars = ranges.map((range) => {
		const sums = periodSums(counters, range)
		return {
			range,
			decided: sums(METRIC.decided),
			trashed: sums(METRIC.trashPictures),
			future: range.from > bounds.today,
			beforeFirst: range.to < firstOf(bounds),
			today: period.kind !== 'all' && holds(range, bounds.today),
		}
	})
	return { unit, bars }
}

/** Days in a row: the streak and the longest run in the period of today and all time, else the longest run inside the period with no `longest` (STATS-001.56). */
export function periodRun(counters: readonly Counter[], period: Period, today: string): { days: number, longest: number | null } {
	if (period.kind === 'all' || holdsToday(period, today)) {
		const run = streak(counters, today)
		return { days: run.current, longest: run.longest }
	}
	return { days: streak(counters.filter((each) => holds(period.range, each.day)), today).longest, longest: null }
}

/** The numbers of a period, with pictures decided compared to the period before (STATS-001.21, STATS-001.41). */
export function periodNumbers(counters: readonly Counter[], period: Period, bounds: PeriodBounds): PeriodNumbers {
	const sums = periodSums(counters, period.range)
	const compared = comparedRange(period, bounds)
	const decided = sums(METRIC.decided)
	const activeMs = sums(METRIC.activeSeconds) * SECOND_MS
	return {
		decided,
		decidedChange: compared === null ? null : percentChange(decided, periodSums(counters, compared.range)(METRIC.decided)),
		compared,
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
		...periodBars(counters, period, bounds),
	}
}
