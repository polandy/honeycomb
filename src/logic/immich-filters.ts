// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Flag } from './decision.ts'
import type { ImmichKind } from './immich-asset.ts'
import type { DecisionFilters, RatingComparison } from './picture-filter.ts'

import { DEFAULT_FILTERS } from './picture-filter.ts'

/** A choice of the time filter; `month` counts from 1. */
export type TimeOption
	= | { readonly kind: 'last-7-days' }
		| { readonly kind: 'month', readonly year: number, readonly month: number }
		| { readonly kind: 'all' }

/** The calendar months are read in; injected so the browser's time zone stays out of the logic. */
export interface Calendar {
	readonly monthOf: (seconds: number) => { readonly year: number, readonly month: number }
	readonly monthStart: (year: number, month: number) => number
}

/** The Immich source's filter bar: time, device and kind, and the decision filters of GRID-002. */
export interface ImmichFilters extends DecisionFilters {
	readonly time: TimeOption
	/** Camera models; `null` stands for *No camera data*. */
	readonly devices: ReadonlySet<string | null>
	readonly kinds: ReadonlySet<ImmichKind>
}

/** A time range in Unix seconds, `takenBefore` exclusive, `null` open (ADR 0044). */
export interface TimeRange {
	readonly takenAfter: number | null
	readonly takenBefore: number | null
}

/** The `filters` of a listing or counts request (ADR 0044). */
export interface RequestFilters extends TimeRange {
	readonly devices: readonly (string | null)[]
	readonly kinds: readonly ImmichKind[]
	readonly flags: readonly Flag[]
	readonly rating: { readonly op: 'atLeast' | 'atMost' | 'exactly', readonly value: number } | null
	readonly colourLabels: readonly ColourLabel[]
}

/** A time option and its count, `null` until the counts arrive. */
export interface CountedTimeOption {
	readonly option: TimeOption
	readonly count: number | null
}

const MS_PER_SECOND = 1000
const DAY_SECONDS = 86400
const RECENT_DAYS = 7
const MONTHS_PER_YEAR = 12
/** The current month and the eleven before it: cheap to count on every change of filter (IMMICH-002.26). */
const COUNTED_MONTHS = 12

const RATING_OPS: Record<RatingComparison, 'atLeast' | 'atMost' | 'exactly'> = { 'at-least': 'atLeast', 'at-most': 'atMost', exactly: 'exactly' }

/** The browser's local calendar. */
export const browserCalendar: Calendar = {
	monthOf: (seconds) => {
		const date = new Date(seconds * MS_PER_SECOND)
		return { year: date.getFullYear(), month: date.getMonth() + 1 }
	},
	monthStart: (year, month) => new Date(year, month - 1, 1).getTime() / MS_PER_SECOND,
}

/** The current month, every device and kind, and the default decision filters. */
export function defaultImmichFilters(now: number, calendar: Calendar): ImmichFilters {
	const { flags, rating, comparison, colourLabels } = DEFAULT_FILTERS
	return { time: { kind: 'month', ...calendar.monthOf(now) }, devices: new Set(), kinds: new Set(), flags, rating, comparison, colourLabels }
}

/** *Last 7 days*, the counted months newest first, and *All phone uploads*. */
export function timeOptions(now: number, calendar: Calendar): TimeOption[] {
	const current = calendar.monthOf(now)
	const months = Array.from({ length: COUNTED_MONTHS }, (_, back): TimeOption => ({ kind: 'month', ...shiftMonth(current.year, current.month, -back) }))
	return [{ kind: 'last-7-days' }, ...months, { kind: 'all' }]
}

/** The time range a time option stands for. */
export function timeRange(option: TimeOption, now: number, calendar: Calendar): TimeRange {
	if (option.kind === 'all') {
		return { takenAfter: null, takenBefore: null }
	}
	if (option.kind === 'last-7-days') {
		return { takenAfter: now - RECENT_DAYS * DAY_SECONDS, takenBefore: null }
	}
	const next = shiftMonth(option.year, option.month, 1)
	return { takenAfter: calendar.monthStart(option.year, option.month), takenBefore: calendar.monthStart(next.year, next.month) }
}

/** The filters as a request sends them. */
export function requestFilters(filters: ImmichFilters, now: number, calendar: Calendar): RequestFilters {
	return {
		...timeRange(filters.time, now, calendar),
		devices: [...filters.devices],
		kinds: [...filters.kinds],
		flags: [...filters.flags],
		rating: filters.rating === null ? null : { op: RATING_OPS[filters.comparison], value: filters.rating },
		colourLabels: [...filters.colourLabels],
	}
}

/** The counts request: the filters and every time option's range. */
export function countsRequest(filters: ImmichFilters, options: readonly TimeOption[], now: number, calendar: Calendar): { filters: RequestFilters, periods: TimeRange[] } {
	return { filters: requestFilters(filters, now, calendar), periods: options.map((option) => timeRange(option, now, calendar)) }
}

/** The time options to show: all until counted, then a month only with uploads, while chosen or when current. */
export function shownTimeOptions(options: readonly TimeOption[], counts: readonly number[] | null, chosen: TimeOption, now: number, calendar: Calendar): CountedTimeOption[] {
	const current: TimeOption = { kind: 'month', ...calendar.monthOf(now) }
	return options
		.map((option, index) => ({ option, count: counts?.[index] ?? null }))
		.filter(({ option, count }) => option.kind !== 'month' || count !== 0 || sameTimeOption(option, chosen) || sameTimeOption(option, current))
}

/** Whether two time options are the same choice. */
function sameTimeOption(a: TimeOption, b: TimeOption): boolean {
	if (a.kind === 'month' && b.kind === 'month') {
		return a.year === b.year && a.month === b.month
	}
	return a.kind === b.kind
}

/** The month `by` months from the given one. */
function shiftMonth(year: number, month: number, by: number): { year: number, month: number } {
	const index = year * MONTHS_PER_YEAR + (month - 1) + by
	return { year: Math.floor(index / MONTHS_PER_YEAR), month: (index % MONTHS_PER_YEAR) + 1 }
}
