// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { changeDirection, periodOverview } from '../../../src/logic/stats-overview.ts'

const NOVEMBER = { from: '2026-11-01', to: '2026-11-30' }

describe('periodOverview', () => {
	const counters = [
		{ day: '2026-10-31', metric: METRIC.picked, value: 500 },
		{ day: '2026-11-02', metric: METRIC.decided, value: 40 },
		{ day: '2026-11-02', metric: METRIC.picked, value: 11 },
		{ day: '2026-11-02', metric: METRIC.rejected, value: 29 },
		{ day: '2026-11-03', metric: METRIC.trashPictures, value: 0 },
		{ day: '2026-11-24', metric: METRIC.decided, value: 46 },
		{ day: '2026-11-24', metric: METRIC.picked, value: 20 },
		{ day: '2026-11-24', metric: METRIC.rejected, value: 26 },
		{ day: '2026-11-24', metric: METRIC.trashPictures, value: 4 },
		{ day: '2026-11-24', metric: METRIC.trashBytes, value: 4000 },
		{ day: '2026-11-24', metric: METRIC.deletedPictures, value: 1 },
		{ day: '2026-11-24', metric: METRIC.deletedBytes, value: 500 },
		{ day: '2026-11-24', metric: METRIC.rawsRemoved, value: 3 },
		{ day: '2026-11-24', metric: METRIC.rawsRemovedBytes, value: 60_000 },
		{ day: '2026-11-24', metric: METRIC.sidecarsCreated, value: 7 },
		{ day: '2026-11-24', metric: METRIC.sidecarsUpdated, value: 3 },
		{ day: '2026-11-24', metric: METRIC.sidecarsForeign, value: 2 },
		{ day: '2026-11-24', metric: METRIC.seriesDone, value: 5 },
		{ day: '2026-11-24', metric: METRIC.activeSeconds, value: 600 },
		{ day: '2026-11-25', metric: METRIC.activeSeconds, value: 30 },
	]

	// spec: STATS-001.59, STATS-001.60, STATS-001.61, STATS-001.62
	it('sums the hero and the tiles of the period, the RAW bytes in the space freed', () => {
		expect(periodOverview(counters, NOVEMBER)).toEqual({
			decided: 86,
			picked: 31,
			rejected: 55,
			keepRate: 36,
			activeDays: 3,
			perActiveDay: 29,
			spaceFreedBytes: 64_500,
			picturesFreed: 5,
			rawsRemoved: 3,
			activeMs: 630_000,
			pace: 8.2,
			sidecarsCreated: 7,
			sidecarsUpdated: 3,
			sidecarsForeign: 2,
			seriesDone: 5,
		})
	})

	// spec: STATS-001.55, STATS-001.60
	it('has no keep rate, no active day and no pace without a decision', () => {
		expect(periodOverview(counters, { from: '2026-09-01', to: '2026-09-30' })).toMatchObject({
			decided: 0,
			keepRate: null,
			activeDays: 0,
			perActiveDay: null,
			spaceFreedBytes: 0,
			pace: null,
		})
	})

	// spec: STATS-001.60
	it('keeps 0 % with only rejected pictures and 100 % with only picked ones', () => {
		const rejected = [{ day: '2026-11-02', metric: METRIC.rejected, value: 12 }]
		const picked = [{ day: '2026-11-02', metric: METRIC.picked, value: 1 }]

		expect(periodOverview(rejected, NOVEMBER).keepRate).toBe(0)
		expect(periodOverview(picked, NOVEMBER).keepRate).toBe(100)
	})

	// spec: STATS-001.62
	it('has no pace below one active minute and one from a minute on', () => {
		const at = (seconds: number) => [{ day: '2026-11-02', metric: METRIC.decided, value: 9 }, { day: '2026-11-02', metric: METRIC.activeSeconds, value: seconds }]

		expect(periodOverview(at(59), NOVEMBER)).toMatchObject({ activeMs: 59_000, pace: null })
		expect(periodOverview(at(60), NOVEMBER).pace).toBe(9)
	})

	// spec: STATS-001.59
	it('counts a day of active time alone as active, and a day with only zeros not', () => {
		const days = [
			{ day: '2026-11-02', metric: METRIC.decided, value: 10 },
			{ day: '2026-11-03', metric: METRIC.activeSeconds, value: 5 },
			{ day: '2026-11-04', metric: METRIC.decided, value: 0 },
		]

		expect(periodOverview(days, NOVEMBER)).toMatchObject({ activeDays: 2, perActiveDay: 5 })
	})
})

describe('changeDirection', () => {
	// spec: STATS-001.41
	it('is more above zero, fewer below and same at zero', () => {
		expect(changeDirection(12)).toBe('more')
		expect(changeDirection(-50)).toBe('fewer')
		expect(changeDirection(0)).toBe('same')
	})
})
