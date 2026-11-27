// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PeriodBounds } from '../../../src/logic/stats-period.ts'

import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { addedCounters, periodIntake, withAdded } from '../../../src/logic/stats-added.ts'
import { periodAt, periodBars } from '../../../src/logic/stats-period.ts'
import { row } from './folder-fixtures.ts'

const BOUNDS: PeriodBounds = { today: '2026-11-26', firstDay: '2026-11-24', firstWeekDay: 1 }
const WEEK = periodAt('week', '2026-11-26', BOUNDS)
const ROWS = [
	row({ fileId: 1, shotDays: [{ day: '2026-11-23', photos: 4 }, { day: '2026-11-25', photos: 10 }] }),
	row({ fileId: 2, shotDays: [{ day: '2026-11-25', photos: 5 }] }),
	row({ fileId: 3, shotDays: [] }),
]

describe('addedCounters', () => {
	// spec: STATS-001.81
	it('sums the shot days of every folder into one counter a day, in day order', () => {
		expect(addedCounters(ROWS)).toEqual([
			{ day: '2026-11-23', metric: METRIC.photosAdded, value: 4 },
			{ day: '2026-11-25', metric: METRIC.photosAdded, value: 15 },
		])
		expect(addedCounters([row({ shotDays: [{ day: '2026-11-25', photos: 1 }] }), row({ shotDays: [{ day: '2026-11-20', photos: 2 }] })]).map((each) => each.day)).toEqual(['2026-11-20', '2026-11-25'])
	})

	// spec: STATS-001.81
	it('has no counter without a folder or a shot day', () => {
		expect(addedCounters([])).toEqual([])
		expect(addedCounters([row({ shotDays: [] })])).toEqual([])
	})
})

describe('withAdded', () => {
	// spec: STATS-001.81
	it('adds each bar\'s photos added, also before the first counted day, and keeps whether it was counted', () => {
		const counters = [{ day: '2026-11-24', metric: METRIC.decided, value: 3 }]
		const bars = withAdded(periodBars(counters, WEEK, BOUNDS).bars, addedCounters(ROWS))

		expect(bars.map((bar) => bar.sums[METRIC.photosAdded] ?? 0)).toEqual([4, 0, 15, 0, 0, 0, 0])
		expect(bars.map((bar) => bar.counted)).toEqual([false, true, false, false, false, false, false])
		expect(bars[0]!.beforeFirst).toBe(true)
		expect(bars[1]!.sums).toEqual({ [METRIC.decided]: 3 })
	})

	// spec: STATS-001.81
	it('leaves the bars as they are without photos added', () => {
		const bars = periodBars([], WEEK, BOUNDS).bars

		expect(withAdded(bars, [])).toEqual(bars)
		expect(withAdded([], addedCounters(ROWS))).toEqual([])
	})
})

describe('periodIntake', () => {
	// spec: STATS-001.83
	it('sums the period\'s photos added against its pictures decided, moved to the trash bin and deleted for good', () => {
		const counters = [
			{ day: '2026-11-24', metric: METRIC.decided, value: 9 },
			{ day: '2026-11-24', metric: METRIC.trashPictures, value: 3 },
			{ day: '2026-11-25', metric: METRIC.deletedPictures, value: 2 },
			{ day: '2026-11-16', metric: METRIC.decided, value: 50 },
		]

		expect(periodIntake(counters, addedCounters(ROWS), WEEK.range)).toEqual({ added: 19, decided: 9, deleted: 5 })
	})

	// spec: STATS-001.83
	it('counts photos added without a decision, and has no line for a period without photos added', () => {
		expect(periodIntake([], addedCounters(ROWS), WEEK.range)).toEqual({ added: 19, decided: 0, deleted: 0 })
		expect(periodIntake([{ day: '2026-11-24', metric: METRIC.decided, value: 9 }], [], WEEK.range)).toBeNull()
		expect(periodIntake([], addedCounters(ROWS), { from: '2026-11-26', to: '2026-11-30' })).toBeNull()
	})
})
