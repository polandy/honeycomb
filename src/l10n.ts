// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCanonicalLocale } from '@nextcloud/l10n'

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

/** A Unix time in seconds as a date and time in the user's locale. */
export function formatDateTime(seconds: number): string {
	return new Intl.DateTimeFormat(getCanonicalLocale(), { dateStyle: 'medium', timeStyle: 'short' }).format(seconds * 1000)
}
