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

/** One field of a decision. */
export type DecisionField = keyof Decision

/** The fields a change sets, applied per sidecar to the decision it states (ADR 0032). */
export type DecisionDelta = Partial<Decision>

/** Every field of a decision, in its order. */
export const DECISION_FIELDS: readonly DecisionField[] = ['rating', 'colourLabel', 'flag', 'keepRaw']

/** A decision as the decision endpoint stores it per member file id (ADR 0012). */
export interface StoredDecision extends Decision {
	readonly fileId: number
}

/** What the predicates read of a decision. */
type FlagOf = Pick<Decision, 'flag'>

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

/** The delta that sets the fields to the decision's values. */
export function deltaOf(decision: Decision, fields: readonly DecisionField[]): DecisionDelta {
	return Object.fromEntries(fields.map((field) => [field, decision[field]]))
}

/** Whether the picture is picked or rejected. */
export function isDecided<T extends FlagOf>(decision: T): decision is T & { readonly flag: 'picked' | 'rejected' } {
	return decision.flag !== 'unflagged'
}

/** Whether the picture is picked. */
export function isPicked<T extends FlagOf>(decision: T): boolean {
	return decision.flag === 'picked'
}

/** Whether the picture is rejected. */
export function isRejected<T extends FlagOf>(decision: T): boolean {
	return decision.flag === 'rejected'
}

/** Whether the picture is still open, neither picked nor rejected. */
export function isOpen<T extends FlagOf>(decision: T): boolean {
	return !isDecided(decision)
}

/** Whether the picture counts as decided: picked, rejected, or unflagged in a done series (SERIES-005.14). */
export function countsAsDecided(decision: FlagOf, seriesDone: boolean): boolean {
	return seriesDone || isDecided(decision)
}

/** The index of the first item after `from` that `decidedOf` does not count as decided, or null when there is none. */
export function nextUndecided<T>(items: readonly T[], from: number, decidedOf: (item: T) => boolean): number | null {
	const found = items.findIndex((item, index) => index > from && !decidedOf(item))
	return found === -1 ? null : found
}
