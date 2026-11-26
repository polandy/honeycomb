// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The days from `from` to `to`, both included, as `YYYY-MM-DD`. */
export interface DayRange {
	readonly from: string
	readonly to: string
}

const DAY_MS = 86_400_000
const DAY_LENGTH = 'YYYY-MM-DD'.length
const YEAR_LENGTH = 'YYYY'.length

/** The `YYYY-MM-DD` day of a UTC time in ms. */
function dayOf(ms: number): string {
	return new Date(ms).toISOString().slice(0, DAY_LENGTH)
}

/** The day `days` after `day` (before, when negative). */
export function addDays(day: string, days: number): string {
	return dayOf(Date.parse(day) + days * DAY_MS)
}

/** The days from `from` to `to`, both included. */
export function dayCount(range: DayRange): number {
	return Math.round((Date.parse(range.to) - Date.parse(range.from)) / DAY_MS) + 1
}

/** The weekday of `day`, 0 for Sunday. */
export function weekDay(day: string): number {
	return new Date(day).getUTCDay()
}

/** The first day of the calendar month of `day`. */
export function monthStart(day: string): string {
	return `${day.slice(0, DAY_LENGTH - 2)}01`
}

/** The last day of the calendar month of `day`. */
export function monthEnd(day: string): string {
	const date = new Date(day)
	return dayOf(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
}

/** The calendar year of `day`. */
export function yearOf(day: string): number {
	return Number(day.slice(0, YEAR_LENGTH))
}

/** The calendar year as a range from 1 January to 31 December. */
export function yearRange(year: number): DayRange {
	return { from: `${year}-01-01`, to: `${year}-12-31` }
}
