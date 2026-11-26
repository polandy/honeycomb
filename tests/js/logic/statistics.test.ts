// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { METRIC, parseCounters, parseReadPictures, percentChange, periodSums, readShares, streak } from '../../../src/logic/statistics.ts'

const TODAY = '2026-11-20'

describe('periodSums', () => {
	// spec: STATS-001.21
	it('sums each metric over the days of the range, both ends included', () => {
		const counters = [
			{ day: '2026-11-13', metric: METRIC.decided, value: 100 },
			{ day: '2026-11-14', metric: METRIC.decided, value: 3 },
			{ day: '2026-11-14', metric: METRIC.trashPictures, value: 2 },
			{ day: TODAY, metric: METRIC.decided, value: 4 },
		]

		const sums = periodSums(counters, { from: '2026-11-14', to: TODAY })

		expect(sums(METRIC.decided)).toBe(7)
		expect(sums(METRIC.trashPictures)).toBe(2)
		expect(sums(METRIC.seriesDone)).toBe(0)
	})
})

describe('percentChange', () => {
	// spec: STATS-001.41
	it('is the whole percent against the period before, or null without numbers before', () => {
		expect(percentChange(118, 100)).toBe(18)
		expect(percentChange(50, 200)).toBe(-75)
		expect(percentChange(1, 3)).toBe(-67)
		expect(percentChange(10, 0)).toBeNull()
	})
})

describe('streak', () => {
	const active = (...days: string[]) => days.map((day) => ({ day, metric: METRIC.activeSeconds, value: 30 }))

	// spec: STATS-001.22
	it('counts the days in a row up to today', () => {
		expect(streak(active('2026-11-16', '2026-11-18', '2026-11-19', TODAY), TODAY)).toEqual({ current: 3, longest: 3 })
	})

	// spec: STATS-001.22
	it('still counts up to yesterday without an action today', () => {
		expect(streak(active('2026-11-18', '2026-11-19'), TODAY)).toEqual({ current: 2, longest: 2 })
	})

	it('is 0 when neither today nor yesterday was active, and keeps the longest run', () => {
		expect(streak(active('2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-11-17'), TODAY)).toEqual({ current: 0, longest: 4 })
	})

	it('leaves out a day whose counters are all zero', () => {
		const counters = [...active('2026-11-19'), { day: TODAY, metric: METRIC.decided, value: 0 }]

		expect(streak(counters, TODAY)).toEqual({ current: 1, longest: 1 })
	})

	it('is 0 and 0 without counters', () => {
		expect(streak([], TODAY)).toEqual({ current: 0, longest: 0 })
	})
})

describe('parseCounters', () => {
	it('keeps the well-formed counters and drops the rest', () => {
		const good = { day: TODAY, metric: METRIC.decided, value: 3 }

		expect(parseCounters([good, null, 'x', { day: '20.11.2026', metric: 'a', value: 1 }, { day: TODAY, metric: 4, value: 1 }, { day: TODAY, metric: 'a', value: 1.5 }])).toEqual([good])
	})
})

describe('parseReadPictures', () => {
	// spec: STATS-001.45
	it('keeps whole numbers and reads anything else as zero', () => {
		expect(parseReadPictures({ pictures: 4, picked: 2, rejected: 1, rated: 2 })).toEqual({ pictures: 4, picked: 2, rejected: 1, rated: 2 })
		expect(parseReadPictures({ pictures: 4, picked: 1.5, rejected: '1' })).toEqual({ pictures: 4, picked: 0, rejected: 0, rated: 0 })
		expect(parseReadPictures(null)).toEqual({ pictures: 0, picked: 0, rejected: 0, rated: 0 })
	})
})

describe('readShares', () => {
	// spec: STATS-001.45
	it('gives the whole percent of the read pictures picked, rejected, unflagged and rated', () => {
		expect(readShares({ pictures: 50, picked: 23, rejected: 10, rated: 30 })).toEqual({ picked: 46, rejected: 20, unflagged: 34, rated: 60 })
	})

	// spec: STATS-001.45
	it('gives no shares while no picture was read', () => {
		expect(readShares({ pictures: 0, picked: 0, rejected: 0, rated: 0 })).toBeNull()
	})
})
