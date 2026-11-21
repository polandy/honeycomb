// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { Series } from '../../../src/logic/series.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { reductionCounts, reductionPlan, withoutSeries } from '../../../src/logic/series-reduction.ts'

interface Shot {
	readonly name: string
	readonly sharpness: number | null
	readonly flag?: Decision['flag']
	readonly locked?: boolean
}

const shot = (name: string, sharpness: number | null, fields: Partial<Shot> = {}): Shot => ({ name, sharpness, ...fields })
const series = (key: number, members: readonly Shot[], done = false): Series<Shot> => ({ key, members, ...(done ? { stored: { id: key, status: 'done', elsewhere: false } } : {}) })
const inputs = {
	sharpnessOf: (picture: Shot) => picture.sharpness,
	decisionOf: (picture: Shot): Decision => ({ ...UNDECIDED, flag: picture.flag ?? 'unflagged' }),
	writable: (picture: Shot) => picture.locked !== true,
}
const names = (shots: readonly Shot[]) => shots.map((picture) => picture.name)

describe('reductionPlan', () => {
	// spec: SERIES-008.1
	it('reduces an open series with a sharpest and leaves out the rest', () => {
		const plan = reductionPlan([
			series(1, [shot('A1', 100), shot('A2', 200), shot('A3', 120)]),
			series(2, [shot('B1', 100), shot('B2', 104)]),
			series(3, [shot('C1', 100, { flag: 'picked' }), shot('C2', 200)]),
			series(4, [shot('D1', 100), shot('D2', 200, { locked: true })]),
			series(5, [shot('E1', 100), shot('E2', 200)], true),
		], inputs)

		expect(plan.reduced.map(({ key, kept, rejected }) => ({ key, kept: kept.name, rejected: names(rejected) }))).toEqual([{ key: 1, kept: 'A2', rejected: ['A1', 'A3'] }])
		expect(plan.leftOut).toBe(3)
	})

	// spec: SERIES-008.1
	it('reduces a series whose sharpest is already picked, and leaves out one without a value', () => {
		const plan = reductionPlan([
			series(1, [shot('A1', 100), shot('A2', 200, { flag: 'picked' })]),
			series(2, [shot('B1', null), shot('B2', 200)]),
		], inputs)

		expect(plan.reduced.map(({ kept }) => kept.name)).toEqual(['A2'])
		expect(plan.leftOut).toBe(1)
	})

	it('is empty without series', () => {
		expect(reductionPlan([], inputs)).toEqual({ reduced: [], leftOut: 0 })
	})
})

describe('withoutSeries and reductionCounts', () => {
	const plan = reductionPlan([
		series(1, [shot('A1', 100), shot('A2', 200), shot('A3', 120)]),
		series(2, [shot('B1', 300), shot('B2', 100), shot('B3', 100), shot('B4', 100)]),
		series(3, [shot('C1', 100), shot('C2', 101)]),
	], inputs)

	// spec: SERIES-008.3
	it('counts the series, the photos to pick and to reject', () => {
		expect(reductionCounts(plan)).toEqual({ series: 2, picked: 2, rejected: 5, leftOut: 1 })
	})

	// spec: SERIES-008.4
	it('leaves a series out by its key and counts it as left out', () => {
		const fewer = withoutSeries(plan, 1)

		expect(fewer.reduced.map(({ key }) => key)).toEqual([2])
		expect(reductionCounts(fewer)).toEqual({ series: 1, picked: 1, rejected: 3, leftOut: 2 })
		expect(withoutSeries(plan, 9)).toEqual(plan)
	})
})
