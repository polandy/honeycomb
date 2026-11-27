// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ActivityLevel } from './activity-level.ts'
import type { Counter } from './statistics.ts'

import { picturesPerMinute } from './active-time.ts'
import { activityLevel } from './activity-level.ts'
import { METRIC, streak } from './statistics.ts'

/** One square of the calendar of active days; shade 0 is a day without a counter, 1 to 3 the share of the busiest day. */
export interface CalendarDay {
	readonly day: string
	readonly shade: ActivityLevel
}

/** The numbers of one year in review (STATS-001.46, .47). */
export interface YearReview {
	readonly year: number
	readonly decided: number
	readonly trashed: number
	readonly freedBytes: number
	readonly deletedForGood: number
	readonly rawsRemoved: number
	readonly rawsRemovedBytes: number
	readonly sidecarsCreated: number
	readonly sidecarsUpdated: number
	readonly sidecarsForeign: number
	readonly seriesDone: number
	readonly longestStreak: number
	readonly activeMs: number
	readonly perMinute: number | null
	readonly busiest: { readonly day: string, readonly decided: number } | null
	readonly calendar: readonly CalendarDay[]
	readonly activeDays: number
	/** The first counted day when the counting began in this year. */
	readonly countedSince: string | null
}

const DECEMBER = '12'
const JANUARY = '01'
const MONTH_START = 5
const MONTH_END = 7
const YEAR_START = 0
const YEAR_END = 4
const DAY_MS = 86_400_000
const SECOND_MS = 1000
const FIRST_YEAR = 1970
const LAST_YEAR = 9999

/** The year whose review is open on `today` (`YYYY-MM-DD`): the year ending in December, the year that ended in January, else none (STATS-001.25). */
export function reviewYear(today: string): number | null {
	const month = today.slice(MONTH_START, MONTH_END)
	const year = Number(today.slice(YEAR_START, YEAR_END))
	if (month === DECEMBER) {
		return year
	}
	return month === JANUARY ? year - 1 : null
}

/** The year whose hint shows on `today`, none once that year was closed (STATS-001.26). */
export function hintYear(today: string, closed: number | null): number | null {
	const year = reviewYear(today)
	return year === closed ? null : year
}

/** The year a view state answer holds as closed, null for anything but a whole year (STATS-001.48). */
export function parseClosedYear(answer: unknown): number | null {
	const value = typeof answer === 'object' && answer !== null ? (answer as Record<string, unknown>).year_review_hint_closed : null
	return typeof value === 'number' && Number.isInteger(value) && value >= FIRST_YEAR && value <= LAST_YEAR ? value : null
}

/** Every day of `year` as `YYYY-MM-DD`. */
function daysOf(year: number): string[] {
	const days: string[] = []
	for (let ms = Date.UTC(year, 0, 1); new Date(ms).getUTCFullYear() === year; ms += DAY_MS) {
		days.push(new Date(ms).toISOString().slice(0, 'YYYY-MM-DD'.length))
	}
	return days
}

/** The year in review of `year`: sums, longest streak, busiest day and the calendar of active days (STATS-001.46, .47, .49). */
export function yearReview(counters: readonly Counter[], year: number, firstDay: string | null): YearReview {
	const prefix = `${year}-`
	const own = counters.filter((each) => each.day.startsWith(prefix))
	const sum = (metric: string): number => own.filter((each) => each.metric === metric).reduce((total, each) => total + each.value, 0)
	const decidedOn = new Map<string, number>()
	own.filter((each) => each.metric === METRIC.decided).forEach((each) => decidedOn.set(each.day, (decidedOn.get(each.day) ?? 0) + each.value))
	const activeOn = new Set(own.filter((each) => each.value > 0).map((each) => each.day))
	const days = daysOf(year)
	const busiest = days.reduce<{ day: string, decided: number } | null>((best, day) => {
		const decided = decidedOn.get(day) ?? 0
		return decided > (best?.decided ?? 0) ? { day, decided } : best
	}, null)
	const decided = sum(METRIC.decided)
	const activeMs = sum(METRIC.activeSeconds) * SECOND_MS
	return {
		year,
		decided,
		trashed: sum(METRIC.trashPictures),
		freedBytes: sum(METRIC.trashBytes) + sum(METRIC.deletedBytes),
		deletedForGood: sum(METRIC.deletedPictures),
		rawsRemoved: sum(METRIC.rawsRemoved),
		rawsRemovedBytes: sum(METRIC.rawsRemovedBytes),
		sidecarsCreated: sum(METRIC.sidecarsCreated),
		sidecarsUpdated: sum(METRIC.sidecarsUpdated),
		sidecarsForeign: sum(METRIC.sidecarsForeign),
		seriesDone: sum(METRIC.seriesDone),
		longestStreak: streak(own, days.at(-1)!).longest,
		activeMs,
		perMinute: picturesPerMinute(decided, activeMs),
		busiest,
		calendar: days.map((day) => ({ day, shade: activityLevel(decidedOn.get(day) ?? 0, busiest?.decided ?? 0, activeOn.has(day)) })),
		activeDays: activeOn.size,
		countedSince: firstDay !== null && firstDay.startsWith(prefix) ? firstDay : null,
	}
}
