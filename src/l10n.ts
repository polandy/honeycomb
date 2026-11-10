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
