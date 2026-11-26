// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCanonicalLocale, t } from '@nextcloud/l10n'

/** Options for t() and n() whose result Vue renders as text, so a folder named "A & B" stays as it is. */
export const PLAIN_TEXT = { escape: false, sanitize: false } as const

/** A count in the user's locale, e.g. "1,840" (ADR 0007). */
export function formatNumber(value: number): string {
	return new Intl.NumberFormat(getCanonicalLocale()).format(value)
}

/** Compares folder and file names in the user's locale, digits by their value: IMG_9 before IMG_10. */
export function nameComparer(): (a: string, b: string) => number {
	return new Intl.Collator(getCanonicalLocale(), { numeric: true }).compare
}

/** A file size in the user's locale in kB, MB or GB, e.g. "24.5 MB". */
export function formatFileSize(bytes: number): string {
	const kilobytes = bytes / 1024
	const [value, unit] = kilobytes >= 1024 ** 2
		? [kilobytes / 1024 ** 2, 'gigabyte']
		: kilobytes >= 1024 ? [kilobytes / 1024, 'megabyte'] : [kilobytes, 'kilobyte']
	return new Intl.NumberFormat(getCanonicalLocale(), { style: 'unit', unit, maximumFractionDigits: 1 }).format(value)
}

/** A Unix time in seconds as a time of day with seconds in the user's locale. */
export function formatTime(seconds: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { timeStyle: 'medium' }).format(seconds * 1000)
}

/** A Unix time in seconds as a date and time in the user's locale. */
export function formatDateTime(seconds: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(seconds * 1000)
}

/** A Unix time in seconds as a date and a time with seconds in the user's locale. */
export function formatDateTimeSeconds(seconds: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { dateStyle: 'medium', timeStyle: 'medium' }).format(seconds * 1000)
}

/** A duration in ms as hours and minutes, or minutes and seconds below an hour, e.g. "2 h 18 min" or "2 min 30 s". */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000)
	const hours = formatNumber(Math.floor(seconds / 3600))
	const minutes = formatNumber(Math.floor(seconds / 60) % 60)
	const rest = formatNumber(seconds % 60)
	if (seconds >= 3600) {
		return t('honeycomb', '{hours} h {minutes} min', { hours, minutes }, undefined, PLAIN_TEXT)
	}
	return seconds >= 60 ? t('honeycomb', '{minutes} min {seconds} s', { minutes, seconds: rest }, undefined, PLAIN_TEXT) : t('honeycomb', '{seconds} s', { seconds: rest }, undefined, PLAIN_TEXT)
}

/** A `YYYY-MM-DD` day in the user's locale, by default as a medium date, e.g. "Nov 1, 2026". */
export function formatDay(day: string, style: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { ...style, timeZone: 'UTC' }).format(Date.parse(day))
}

/** A month, counted from 1, in the user's locale, e.g. "November 2026". */
export function formatMonth(year: number, month: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(year, month - 1, 1))
}

/** The days from `from` to `to` in the user's locale, by default e.g. "Oct 24 – 30". */
export function formatDayRange(from: string, to: string, style: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { ...style, timeZone: 'UTC' }).formatRange(Date.parse(from), Date.parse(to))
}

/** A whole percent in the user's locale, e.g. "79 %", or signed, e.g. "+18 %". */
export function formatPercent(percent: number, signed = false): string {
	return new Intl.NumberFormat(getCanonicalLocale(), { style: 'percent', signDisplay: signed ? 'exceptZero' : 'auto' }).format(percent / 100)
}

/** A Unix time in seconds as its local day with the weekday in the user's locale, the Immich grid's day header. */
export function formatCaptureDay(seconds: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { dateStyle: 'full' }).format(seconds * 1000)
}
