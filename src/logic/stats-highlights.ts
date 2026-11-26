// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DayRange } from './days.ts'
import type { Counter } from './statistics.ts'
import type { ChangeDirection } from './stats-overview.ts'
import type { Period, PeriodBounds } from './stats-period.ts'

import { addDays, dayCount, weekDay } from './days.ts'
import { METRIC, periodSums } from './statistics.ts'
import { changeDirection, PACE_STEPS, periodOverview } from './stats-overview.ts'
import { comparedRange } from './stats-period.ts'

/** The day with the most pictures decided. */
export interface BestDay {
	readonly day: string
	readonly decided: number
	readonly activeSeconds: number
}

/** One weekday's average pictures decided, 0 for Sunday. */
export interface WeekdayAverage {
	readonly weekday: number
	readonly average: number
}

/** The busiest weekday and the seven averages from the locale's first weekday. */
export interface BusiestWeekday {
	readonly weekday: number
	readonly days: readonly WeekdayAverage[]
}

/** The pictures decided a minute of the period and of the days compared with, null without a pace, and the change between them. */
export interface PaceHighlight {
	readonly pace: number | null
	readonly before: number | null
	readonly change: { readonly direction: ChangeDirection, readonly amount: number } | null
}

/** The longest run of days with a counter, its length and first and last day. */
export interface LongestStreak {
	readonly length: number
	readonly from: string
	readonly to: string
}

/** The five highlights of one period (STATS-001.67). */
export interface Highlights {
	readonly bestDay: BestDay | null
	readonly busiestWeekday: BusiestWeekday | null
	readonly pace: PaceHighlight
	readonly activeDays: { readonly active: number, readonly days: number }
	readonly longestStreak: LongestStreak | null
}

const WEEK_DAYS = 7

/** The pace and its change, in tenths so that equal paces are the same (STATS-001.69). */
function paceOf(pace: number | null, before: number | null): PaceHighlight {
	if (pace === null || before === null) {
		return { pace, before, change: null }
	}
	const tenths = Math.round((pace - before) * PACE_STEPS)
	return { pace, before, change: { direction: changeDirection(tenths), amount: Math.abs(tenths) / PACE_STEPS } }
}

/** The days of `range` that carry a counter above zero, oldest first. */
function activeDaysOf(counters: readonly Counter[], range: DayRange): string[] {
	return [...new Set(counters.filter((each) => each.value > 0 && each.day >= range.from && each.day <= range.to).map((each) => each.day))].sort()
}

/** The day of `days` with the most pictures decided, the earlier on a tie (STATS-001.68). */
function bestDayOf(counters: readonly Counter[], days: readonly string[]): BestDay | null {
	let best: BestDay | null = null
	for (const day of days) {
		const sums = periodSums(counters, { from: day, to: day })
		const decided = sums(METRIC.decided)
		if (decided > (best?.decided ?? 0)) {
			best = { day, decided, activeSeconds: sums(METRIC.activeSeconds) }
		}
	}
	return best
}

/** The average pictures decided of each weekday over the days of `range`, from `firstWeekDay` on; the first of the week on a tie (STATS-001.69). */
function busiestWeekdayOf(counters: readonly Counter[], range: DayRange, firstWeekDay: number): BusiestWeekday | null {
	const total = Array<number>(WEEK_DAYS).fill(0)
	const count = Array<number>(WEEK_DAYS).fill(0)
	for (let day = range.from; day <= range.to; day = addDays(day, 1)) {
		count[weekDay(day)]!++
	}
	counters.filter((each) => each.metric === METRIC.decided && each.day >= range.from && each.day <= range.to).forEach((each) => {
		total[weekDay(each.day)]! += each.value
	})
	const days = Array.from({ length: WEEK_DAYS }, (_, index) => {
		const weekday = (firstWeekDay + index) % WEEK_DAYS
		return { weekday, average: count[weekday] === 0 ? 0 : total[weekday]! / count[weekday]! }
	})
	const top = days.reduce((best, each) => (each.average > best.average ? each : best))
	return top.average > 0 ? { weekday: top.weekday, days } : null
}

/** The longest run of consecutive `days`, the earlier run on a tie (STATS-001.69). */
function longestStreakOf(days: readonly string[]): LongestStreak | null {
	let best: LongestStreak | null = null
	let from = ''
	days.forEach((day, index) => {
		if (index === 0 || addDays(days[index - 1]!, 1) !== day) {
			from = day
		}
		const length = dayCount({ from, to: day })
		if (length > (best?.length ?? 0)) {
			best = { length, from, to: day }
		}
	})
	return best
}

/** The five highlights of a period, null when no counter lies in it (STATS-001.67 to STATS-001.69). */
export function periodHighlights(counters: readonly Counter[], period: Period, bounds: PeriodBounds): Highlights | null {
	const { range } = period
	if (!counters.some((each) => each.day >= range.from && each.day <= range.to)) {
		return null
	}
	const days = activeDaysOf(counters, range)
	const from = bounds.firstDay !== null && bounds.firstDay > range.from ? bounds.firstDay : range.from
	const to = range.to < bounds.today ? range.to : bounds.today
	const counted = { from, to: to < from ? from : to }
	const compared = comparedRange(period, bounds)
	return {
		bestDay: bestDayOf(counters, days),
		busiestWeekday: busiestWeekdayOf(counters, counted, bounds.firstWeekDay),
		pace: paceOf(periodOverview(counters, range).pace, compared === null ? null : periodOverview(counters, compared.range).pace),
		activeDays: { active: days.length, days: dayCount(counted) },
		longestStreak: longestStreakOf(days),
	}
}
