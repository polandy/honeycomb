// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Picture } from './pairing.ts'

/** digiKam's nine colour labels, in the palette's order (ADR 0012). */
export const COLOUR_LABELS = ['red', 'orange', 'yellow', 'green', 'blue', 'magenta', 'gray', 'black', 'white'] as const

/** One of the nine colour labels. */
export type ColourLabel = typeof COLOUR_LABELS[number]

/** A picture's flag; picked and rejected are decided. */
export type Flag = 'picked' | 'rejected' | 'unflagged'

/** Rating, colour label, flag and Keep RAW of one picture. */
export interface Decision {
	readonly rating: number
	readonly colourLabel: ColourLabel | null
	readonly flag: Flag
	readonly keepRaw: boolean
}

/** A decision as the decision endpoint stores it per member file id (ADR 0012). */
export interface StoredDecision extends Decision {
	readonly fileId: number
}

/** The decision of a picture without a stored row. */
export const UNDECIDED: Decision = { rating: 0, colourLabel: null, flag: 'unflagged', keepRaw: false }

/** The stored decisions keyed by their file id. */
export function decisionsByFileId(rows: readonly StoredDecision[]): Map<number, Decision> {
	return new Map(rows.map(({ fileId, ...decision }) => [fileId, decision]))
}

/** The rendered member's decision, else the RAW member's, else undecided (`docs/decisions.md`). */
export function pictureDecision(picture: Picture<{ readonly fileId: number }>, byFileId: ReadonlyMap<number, Decision>): Decision {
	return (picture.rendered && byFileId.get(picture.rendered.fileId))
		?? (picture.raw && byFileId.get(picture.raw.fileId))
		?? UNDECIDED
}

/** Whether two decisions hold the same values. */
export function sameDecision(a: Decision, b: Decision): boolean {
	return a.rating === b.rating && a.colourLabel === b.colourLabel && a.flag === b.flag && a.keepRaw === b.keepRaw
}

/** Whether the picture is picked or rejected. */
export function isDecided(decision: Decision): boolean {
	return decision.flag !== 'unflagged'
}

/** The index of the first undecided item after `from`, or null when every later item is decided. */
export function nextUndecided<T>(items: readonly T[], from: number, decisionOf: (item: T) => Decision): number | null {
	const found = items.findIndex((item, index) => index > from && !isDecided(decisionOf(item)))
	return found === -1 ? null : found
}
