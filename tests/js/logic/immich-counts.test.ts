// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ImmichCounts } from '../../../src/logic/immich-counts.ts'
import type { DecisionFilters } from '../../../src/logic/picture-filter.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { countsAfterDecision } from '../../../src/logic/immich-counts.ts'

const COUNTS: ImmichCounts = {
	total: 3660,
	undecided: 3412,
	decided: 248,
	matching: 3532,
	flags: { picked: 120, rejected: 128, unflagged: 3412 },
	ratings: { 0: 3500, 1: 0, 2: 40, 3: 80, 4: 30, 5: 10 },
	colourLabels: { red: 4 },
	devices: [{ model: 'Pixel 9 Pro', count: 2810 }, { model: null, count: 112 }],
	kinds: { photo: 3100, live: 400, video: 160 },
	periods: [1204, 318],
}

const NOT_REJECTED: DecisionFilters = { rating: null, comparison: 'at-least', colourLabels: new Set(), flags: new Set(['picked', 'unflagged']) }
const decision = (fields: Partial<Decision>): Decision => ({ ...UNDECIDED, ...fields })

describe('countsAfterDecision', () => {
	// spec: IMMICH-002.15
	it('moves a pick from unflagged to picked and keeps the matching count when both pass', () => {
		const after = countsAfterDecision(COUNTS, UNDECIDED, decision({ flag: 'picked' }), NOT_REJECTED)

		expect(after.flags).toEqual({ picked: 121, rejected: 128, unflagged: 3411 })
		expect(after.undecided).toBe(3411)
		expect(after.decided).toBe(249)
		expect(after.matching).toBe(3532)
		expect(after.total).toBe(3660)
	})

	// spec: IMMICH-002.15
	it('drops a reject from the matching count when the filter refuses it', () => {
		const after = countsAfterDecision(COUNTS, UNDECIDED, decision({ flag: 'rejected' }), NOT_REJECTED)

		expect(after.matching).toBe(3531)
		expect(after.flags.rejected).toBe(129)
	})

	// spec: IMMICH-002.15
	it('moves the rating and the colour label', () => {
		const before = decision({ rating: 2, colourLabel: 'red', flag: 'picked' })
		const after = countsAfterDecision(COUNTS, before, decision({ rating: 4, colourLabel: 'blue', flag: 'picked' }), NOT_REJECTED)

		expect(after.ratings).toEqual({ ...COUNTS.ratings, 2: 39, 4: 31 })
		expect(after.colourLabels).toEqual({ red: 3, blue: 1 })
		expect(after.flags).toEqual(COUNTS.flags)
	})

	it('leaves the facets and the counts alone for an unchanged decision', () => {
		const same = decision({ flag: 'picked' })
		const after = countsAfterDecision(COUNTS, same, same, NOT_REJECTED)

		expect(after).toEqual(COUNTS)
	})
})
