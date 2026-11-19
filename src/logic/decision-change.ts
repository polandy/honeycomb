// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, DecisionField, Flag, StoredDecision } from './decision.ts'
import type { Picture } from './pairing.ts'

import { DECISION_FIELDS, UNDECIDED } from './decision.ts'

/** A picture with its current decision. */
export interface Decided {
	readonly picture: Picture<{ readonly fileId: number }>
	readonly decision: Decision
}

/** What a control of the action bar asks for, before the toggle rules apply. */
export type DecisionIntent
	= | { readonly kind: 'rating', readonly rating: number }
		| { readonly kind: 'colourLabel', readonly colourLabel: ColourLabel | null }
		| { readonly kind: 'flag', readonly flag: Flag }
		| { readonly kind: 'keepRaw' }

/** One field of a decision set to a value. */
export type DecisionChange
	= | { readonly rating: number }
		| { readonly colourLabel: ColourLabel | null }
		| { readonly flag: Flag }
		| { readonly keepRaw: boolean }
		| typeof CLEARED

/** Each value the pictures share, undefined where they differ; Keep RAW over the pairs only. */
export interface CommonDecision {
	readonly rating: number | undefined
	readonly colourLabel: ColourLabel | null | undefined
	readonly flag: Flag | undefined
	readonly keepRaw: boolean | undefined
	/** Whether any picture is a pair, so Keep RAW applies. */
	readonly canKeepRaw: boolean
}

/** The state *Clear picks/rejects* resets a picture to (GRID-001.22). */
export const CLEARED = { flag: 'unflagged', keepRaw: false } as const

/** Whether the picture has both members, the only kind that can keep its RAW. */
export const isPair = ({ picture }: Decided) => picture.rendered !== null && picture.raw !== null

/** The value every decision shares, undefined when they differ or there are none. */
function shared<K extends keyof Decision>(decisions: readonly Decision[], key: K): Decision[K] | undefined {
	const first = decisions[0]
	return first !== undefined && decisions.every((decision) => decision[key] === first[key]) ? first[key] : undefined
}

/** The values the pictures share, for the action bar of a selection. */
export function commonDecision(pictures: readonly Decided[]): CommonDecision {
	const decisions = pictures.map(({ decision }) => decision)
	const pairs = pictures.filter(isPair).map(({ decision }) => decision)
	return {
		rating: shared(decisions, 'rating'),
		colourLabel: shared(decisions, 'colourLabel'),
		flag: shared(decisions, 'flag'),
		keepRaw: shared(pairs, 'keepRaw'),
		canKeepRaw: pairs.length > 0,
	}
}

/** The change an intent makes: a flag or label every picture has comes off, Keep RAW flips over the pairs. */
export function resolveChange(intent: DecisionIntent, pictures: readonly Decided[]): DecisionChange {
	const common = commonDecision(pictures)
	switch (intent.kind) {
		case 'rating':
			return { rating: intent.rating }
		case 'flag':
			return { flag: common.flag === intent.flag ? 'unflagged' : intent.flag }
		case 'colourLabel':
			return { colourLabel: common.colourLabel === intent.colourLabel ? null : intent.colourLabel }
		case 'keepRaw':
			return { keepRaw: common.keepRaw !== true }
	}
}

/** The whole states to store for every member of each picture the change alters (ADR 0012). */
export function changedRows(pictures: readonly Decided[], change: DecisionChange): StoredDecision[] {
	const applies = 'keepRaw' in change ? pictures.filter(isPair) : pictures
	return applies.flatMap(({ picture, decision }) => {
		const next = { ...decision, ...change }
		const unchanged = (Object.keys(change) as (keyof Decision)[]).every((key) => decision[key] === next[key])
		return unchanged ? [] : [picture.rendered, picture.raw].filter((member) => member !== null).map(({ fileId }) => ({ fileId, ...next }))
	})
}

/** The fields the rows change against the decisions they replace, undecided where none was stored. */
export function changedFields(rows: readonly StoredDecision[], before: ReadonlyMap<number, Decision>): DecisionField[] {
	return DECISION_FIELDS.filter((field) => rows.some((row) => row[field] !== (before.get(row.fileId) ?? UNDECIDED)[field]))
}

/** The rows that take the fields of the written rows back to `before`, where they still hold what was written (XMP-008.15, .17). */
export function takenBack(decisions: ReadonlyMap<number, Decision>, written: readonly StoredDecision[], before: ReadonlyMap<number, Decision>, fields: readonly DecisionField[]): StoredDecision[] {
	return written.map((row) => {
		const current = decisions.get(row.fileId) ?? UNDECIDED
		const earlier = before.get(row.fileId) ?? UNDECIDED
		const back = Object.fromEntries(fields.filter((field) => current[field] === row[field]).map((field) => [field, earlier[field]]))
		return { fileId: row.fileId, ...current, ...back }
	})
}

/** The decisions with the rows put over them. */
export function withRows(decisions: ReadonlyMap<number, Decision>, rows: readonly StoredDecision[]): Map<number, Decision> {
	const next = new Map(decisions)
	for (const { fileId, ...decision } of rows) {
		next.set(fileId, decision)
	}
	return next
}
