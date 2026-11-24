// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag } from '../../../src/logic/decision.ts'
import type { RatingComparison } from '../../../src/logic/picture-filter.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { REQUEST_RATING_OPS } from '../../../src/logic/immich-filters.ts'
import { matchesDecision } from '../../../src/logic/picture-filter.ts'
import vectors from '../../fixtures/decision-filter/vectors.json' with { type: 'json' }

interface VectorFilters {
	readonly flags?: readonly string[]
	readonly rating?: { readonly op: string, readonly value: number }
	readonly colourLabels?: readonly string[]
}

/** The grid's comparison that a request sends as this op. */
function comparisonOf(op: string): RatingComparison {
	const found = Object.entries(REQUEST_RATING_OPS).find(([, requested]) => requested === op)
	if (found === undefined) {
		throw new Error(`no comparison sends ${op}`)
	}
	return found[0] as RatingComparison
}

describe('matchesDecision on the shared vectors', () => {
	// spec: IMMICH-002.29
	it.each(vectors.cases)('$name', ({ filters, decision, admits }) => {
		const chosen: VectorFilters = filters
		const judged: Decision = { ...UNDECIDED, ...decision, flag: decision.flag as Flag, colourLabel: decision.colourLabel as ColourLabel | null }

		expect(matchesDecision(judged, {
			flags: new Set((chosen.flags ?? []) as Flag[]),
			rating: chosen.rating?.value ?? null,
			comparison: comparisonOf(chosen.rating?.op ?? 'atLeast'),
			colourLabels: new Set((chosen.colourLabels ?? []) as ColourLabel[]),
		})).toBe(admits)
	})

	it('names no op that no comparison sends', () => {
		expect(() => comparisonOf('between')).toThrow('no comparison sends between')
	})
})
