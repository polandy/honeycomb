// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityLevel } from './activity-level.ts'
import type { Counter } from './statistics.ts'
import type { Period, PeriodBar, PeriodBounds } from './stats-period.ts'

import { activityLevel } from './activity-level.ts'
import { monthStart, weekDay, yearOf, yearRange } from './days.ts'
import { METRIC } from './statistics.ts'
import { periodBars } from './stats-period.ts'

/** One square: a day or a month of all time with its level. */
export interface CalendarSquare {
	readonly bar: PeriodBar
	readonly level: ActivityLevel
}

/** The squares of one month, or of one year of all time, after `lead` empty places in the first row of seven. */
export interface CalendarGroup {
	/** The first day of the month or year. */
	readonly anchor: string
	readonly lead: number
	readonly squares: readonly CalendarSquare[]
}

/** The calendar of a period: days of a week or month, months with their days in a year, years with their months in all time (STATS-001.70). */
export interface Calendar {
	readonly layout: 'days' | 'year' | 'all'
	readonly unit: 'day' | 'month'
	/** The weekdays of the first row, 0 for Sunday, from the locale's first. */
	readonly weekDays: readonly number[]
	readonly groups: readonly CalendarGroup[]
}

const WEEK_DAYS = 7

/** The squares of `bars` with the level against the busiest of them (STATS-001.71). */
function squaresOf(bars: readonly PeriodBar[]): CalendarSquare[] {
	const decided = (bar: PeriodBar): number => bar.sums[METRIC.decided] ?? 0
	const busiest = Math.max(0, ...bars.map(decided))
	return bars.map((bar) => ({ bar, level: activityLevel(decided(bar), busiest, bar.counted) }))
}

/** Splits `squares` into groups that start where `anchorOf` changes; `lead` counts the empty places of each. */
function grouped(squares: readonly CalendarSquare[], anchorOf: (day: string) => string, lead: (anchor: string) => number): CalendarGroup[] {
	const groups = new Map<string, CalendarSquare[]>()
	squares.forEach((square) => {
		const anchor = anchorOf(square.bar.range.from)
		groups.set(anchor, [...(groups.get(anchor) ?? []), square])
	})
	return [...groups].map(([anchor, own]) => ({ anchor, lead: lead(anchor), squares: own }))
}

/** The calendar of a period: its days, or for a year the days of each month, or for all time the months of each year, with the days to come and before the first counted day marked. */
export function periodCalendar(counters: readonly Counter[], period: Period, bounds: PeriodBounds): Calendar {
	const { kind, range } = period
	const weekDays = Array.from({ length: WEEK_DAYS }, (_, index) => (bounds.firstWeekDay + index) % WEEK_DAYS)
	const lead = (anchor: string): number => (weekDay(anchor) - bounds.firstWeekDay + WEEK_DAYS) % WEEK_DAYS
	if (kind === 'all') {
		const years = { from: yearRange(yearOf(range.from)).from, to: yearRange(yearOf(range.to)).to }
		const squares = squaresOf(periodBars(counters, { kind: 'year', range: years }, bounds).bars)
		return { layout: 'all', unit: 'month', weekDays, groups: grouped(squares, (day) => yearRange(yearOf(day)).from, () => 0) }
	}
	const squares = squaresOf(periodBars(counters, { kind: 'month', range }, bounds).bars)
	return kind === 'year'
		? { layout: 'year', unit: 'day', weekDays, groups: grouped(squares, monthStart, lead) }
		: { layout: 'days', unit: 'day', weekDays, groups: [{ anchor: range.from, lead: lead(range.from), squares }] }
}
