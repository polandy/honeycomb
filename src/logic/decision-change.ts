// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag, StoredDecision } from './decision.ts'
import type { Picture } from './pairing.ts'

import { sameDecision } from './decision.ts'

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

/** Each value the pictures share, undefined where they differ; Keep RAW over the pairs only. */
export interface CommonDecision {
	readonly rating: number | undefined
	readonly colourLabel: ColourLabel | null | undefined
	readonly flag: Flag | undefined
	readonly keepRaw: boolean | undefined
	/** Whether any picture is a pair, so Keep RAW applies. */
	readonly canKeepRaw: boolean
}

/** Whether the picture has both members, the only kind that can keep its RAW. */
const isPair = ({ picture }: Decided) => picture.rendered !== null && picture.raw !== null

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

/** The decisions with the rows put over them. */
export function withRows(decisions: ReadonlyMap<number, Decision>, rows: readonly StoredDecision[]): Map<number, Decision> {
	const next = new Map(decisions)
	for (const { fileId, ...decision } of rows) {
		next.set(fileId, decision)
	}
	return next
}

/** The decisions with each row that still stands set back to what it replaced in `before`. */
export function revertRows(decisions: ReadonlyMap<number, Decision>, rows: readonly StoredDecision[], before: ReadonlyMap<number, Decision>): Map<number, Decision> {
	const next = new Map(decisions)
	for (const { fileId, ...written } of rows) {
		const current = next.get(fileId)
		if (current === undefined || !sameDecision(current, written)) {
			continue
		}
		const earlier = before.get(fileId)
		if (earlier === undefined) {
			next.delete(fileId)
		} else {
			next.set(fileId, earlier)
		}
	}
	return next
}
