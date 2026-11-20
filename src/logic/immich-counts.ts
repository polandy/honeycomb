// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag } from './decision.ts'
import type { ImmichKind } from './immich-asset.ts'
import type { DecisionFilters } from './picture-filter.ts'

import { matchesDecision } from './picture-filter.ts'

/** The counts endpoint's answer (ADR 0044): the toolbar's numbers and each filter option's. */
export interface ImmichCounts {
	readonly total: number
	readonly undecided: number
	readonly decided: number
	readonly matching: number
	readonly flags: Readonly<Record<Flag, number>>
	readonly ratings: Readonly<Partial<Record<number, number>>>
	readonly colourLabels: Readonly<Partial<Record<ColourLabel, number>>>
	readonly devices: readonly { readonly model: string | null, readonly count: number }[]
	readonly kinds: Readonly<Record<ImmichKind, number>>
	readonly periods: readonly number[]
}

/** The counts after one asset's decision changed, without asking the server (IMMICH-002.15); the facets do not count decisions. */
export function countsAfterDecision(counts: ImmichCounts, before: Decision, after: Decision, filters: DecisionFilters): ImmichCounts {
	const flags = { ...counts.flags, ...moved(counts.flags, before.flag, after.flag) }
	return {
		...counts,
		undecided: flags.unflagged,
		decided: counts.total - flags.unflagged,
		matching: counts.matching - Number(matchesDecision(before, filters)) + Number(matchesDecision(after, filters)),
		flags,
		ratings: moved(counts.ratings, before.rating, after.rating),
		colourLabels: moved(counts.colourLabels, before.colourLabel, after.colourLabel),
	}
}

/** The numbers with one moved from one key to another. */
function moved<K extends PropertyKey>(numbers: Readonly<Partial<Record<K, number>>>, from: K | null, to: K | null): Partial<Record<K, number>> {
	const next: Partial<Record<K, number>> = { ...numbers }
	if (from === to) {
		return next
	}
	if (from !== null) {
		next[from] = (next[from] ?? 0) - 1
	}
	if (to !== null) {
		next[to] = (next[to] ?? 0) + 1
	}
	return next
}
