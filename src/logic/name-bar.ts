// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The trailing number a shortened name keeps, with the separator before it, at most ten digits. */
const TRAILING_NUMBER = /[-_. ]?\d{1,10}$/

/** How many last characters a name without a trailing number keeps. */
const TAIL_LENGTH = 4

/** A base name split for the name bar: the head shortens with `…`, the tail always shows (GRID-004.5). */
export function nameParts(baseName: string): { head: string, tail: string } {
	const number = TRAILING_NUMBER.exec(baseName)
	const cut = number !== null ? number.index : Math.max(baseName.length - TAIL_LENGTH, TAIL_LENGTH)
	return { head: baseName.slice(0, cut), tail: baseName.slice(cut) }
}
