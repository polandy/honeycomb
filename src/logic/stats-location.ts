// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Period, PeriodBounds, PeriodKind } from './stats-period.ts'

import { monthEnd, yearOf } from './days.ts'
import { holdsToday, periodAt } from './stats-period.ts'

/** The period an address names: its kind and a day in it, null for the period of today. */
export interface PeriodLocation {
	readonly kind: PeriodKind
	readonly day: string | null
}

/** What the page shows for a location: the segment and the day whose period shows, null for today. */
export interface ResolvedLocation {
	readonly kind: PeriodKind
	readonly anchor: string | null
}

const KINDS: readonly PeriodKind[] = ['week', 'month', 'year', 'all']
const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/u
const MONTH_PATTERN = /^\d{4}-\d{2}$/u
const YEAR_PATTERN = /^\d{4}$/u
const MONTH_LENGTH = 'YYYY-MM'.length
const DEFAULT_KIND: PeriodKind = 'month'

/** The first day a value names, or null when it is no real calendar day. */
function realDay(day: string): string | null {
	const month = Number(day.slice(5, 7))
	return month >= 1 && month <= 12 && Number(day.slice(8)) >= 1 && Number(day.slice(8)) <= Number(monthEnd(`${day.slice(0, MONTH_LENGTH)}-01`).slice(8)) ? day : null
}

/** The day a kind's value names: a day for a week, a month or year by its first day; null when malformed. */
function valueDay(kind: PeriodKind, value: string): string | null {
	if (kind === 'week') {
		return DAY_PATTERN.test(value) ? realDay(value) : null
	}
	if (kind === 'month') {
		return MONTH_PATTERN.test(value) ? realDay(`${value}-01`) : null
	}
	return kind === 'year' && YEAR_PATTERN.test(value) ? `${value}-01-01` : null
}

/** The period an address hash names; null for no hash, another hash or a malformed one (STATS-001.58). */
export function parsePeriodHash(hash: string): PeriodLocation | null {
	const [name = '', value, ...rest] = hash.replace(/^#/u, '').split('=')
	const kind = KINDS.find((each) => each === name)
	if (hash === '' || !hash.startsWith('#') || kind === undefined || rest.length > 0) {
		return null
	}
	if (value === undefined) {
		return { kind, day: null }
	}
	const day = valueDay(kind, value)
	return day === null ? null : { kind, day }
}

/** The segment and anchor to show: the month of today without a location, the nearest counted period for a day outside the counted days (STATS-001.58). */
export function resolveLocation(location: PeriodLocation | null, bounds: PeriodBounds): ResolvedLocation {
	if (location === null || location.day === null) {
		return { kind: location?.kind ?? DEFAULT_KIND, anchor: null }
	}
	const first = bounds.firstDay ?? bounds.today
	const day = location.day < first ? first : location.day
	if (day > bounds.today) {
		return { kind: location.kind, anchor: null }
	}
	return { kind: location.kind, anchor: holdsToday(periodAt(location.kind, day, bounds), bounds.today) ? null : day }
}

/** The address hash of a period: none for the month of today, the bare name for the week and year of today (STATS-001.57). */
export function periodHash(period: Period, today: string): string {
	const { kind, range } = period
	if (kind === 'all') {
		return '#all'
	}
	if (holdsToday(period, today)) {
		return kind === DEFAULT_KIND ? '' : `#${kind}`
	}
	return `#${kind}=${{ week: range.from, month: range.from.slice(0, MONTH_LENGTH), year: String(yearOf(range.from)) }[kind]}`
}
