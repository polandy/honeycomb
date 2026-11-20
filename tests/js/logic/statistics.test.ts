// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { folderSetShare, METRIC, parseCounters, percentChange, periodBars, periodNumbers, periodRange, periodSums, rangeBefore, streak } from '../../../src/logic/statistics.ts'

const TODAY = '2026-11-20'

describe('periodRange', () => {
	// spec: STATS-001.21
	it('ends each period today and starts it 7 days, 30 days, 1 January or the first counted day back', () => {
		expect(periodRange('week', TODAY, '2026-01-05')).toEqual({ from: '2026-11-14', to: TODAY })
		expect(periodRange('month', TODAY, '2026-01-05')).toEqual({ from: '2026-10-22', to: TODAY })
		expect(periodRange('year', TODAY, '2025-03-01')).toEqual({ from: '2026-01-01', to: TODAY })
		expect(periodRange('all', TODAY, '2025-03-01')).toEqual({ from: '2025-03-01', to: TODAY })
	})

	it('starts all time today without a counted day', () => {
		expect(periodRange('all', TODAY, null)).toEqual({ from: TODAY, to: TODAY })
	})
})

describe('rangeBefore', () => {
	// spec: STATS-001.41
	it('is the range of the same length that ends the day before', () => {
		expect(rangeBefore({ from: '2026-10-22', to: TODAY })).toEqual({ from: '2026-09-22', to: '2026-10-21' })
		expect(rangeBefore({ from: '2026-03-01', to: '2026-03-01' })).toEqual({ from: '2026-02-28', to: '2026-02-28' })
	})
})

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

describe('periodBars', () => {
	const counters = [
		{ day: '2026-11-14', metric: METRIC.decided, value: 3 },
		{ day: '2026-11-14', metric: METRIC.trashPictures, value: 1 },
		{ day: '2026-10-23', metric: METRIC.decided, value: 5 },
		{ day: '2026-01-31', metric: METRIC.decided, value: 2 },
		{ day: '2026-02-01', metric: METRIC.trashPictures, value: 6 },
		{ day: '2026-11-14', metric: METRIC.seriesDone, value: 9 },
	]

	// spec: STATS-001.21
	it('splits 7 days per day', () => {
		const bars = periodBars(counters, 'week', periodRange('week', TODAY, null))

		expect(bars.map((bar) => bar.range.from)).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', TODAY])
		expect(bars[0]).toEqual({ range: { from: '2026-11-14', to: '2026-11-14' }, decided: 3, trashed: 1 })
	})

	// spec: STATS-001.21
	it('splits 30 days into 7 days each, ending today, the oldest bar shorter', () => {
		const bars = periodBars(counters, 'month', periodRange('month', TODAY, null))

		expect(bars.map((bar) => bar.range)).toEqual([
			{ from: '2026-10-22', to: '2026-10-23' },
			{ from: '2026-10-24', to: '2026-10-30' },
			{ from: '2026-10-31', to: '2026-11-06' },
			{ from: '2026-11-07', to: '2026-11-13' },
			{ from: '2026-11-14', to: TODAY },
		])
		expect(bars.map((bar) => bar.decided)).toEqual([5, 0, 0, 0, 3])
	})

	// spec: STATS-001.21
	it('splits the year and all time per calendar month, clipped to the range', () => {
		const year = periodBars(counters, 'year', periodRange('year', TODAY, null))
		const all = periodBars(counters, 'all', periodRange('all', TODAY, '2025-12-15'))

		expect(year).toHaveLength(11)
		expect(year[0]).toEqual({ range: { from: '2026-01-01', to: '2026-01-31' }, decided: 2, trashed: 0 })
		expect(year[1]).toEqual({ range: { from: '2026-02-01', to: '2026-02-28' }, decided: 0, trashed: 6 })
		expect(year[10]!.range).toEqual({ from: '2026-11-01', to: TODAY })
		expect(all[0]!.range).toEqual({ from: '2025-12-15', to: '2025-12-31' })
		expect(all).toHaveLength(12)
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

describe('folderSetShare', () => {
	// spec: STATS-001.42
	it('is the whole percent decided, rounded down, and done only when every picture is', () => {
		expect(folderSetShare(79, 100)).toEqual({ percent: 79, done: false })
		expect(folderSetShare(999, 1000)).toEqual({ percent: 99, done: false })
		expect(folderSetShare(40, 40)).toEqual({ percent: 100, done: true })
		expect(folderSetShare(0, 0)).toEqual({ percent: 0, done: false })
	})
})

describe('parseCounters', () => {
	it('keeps the well-formed counters and drops the rest', () => {
		const good = { day: TODAY, metric: METRIC.decided, value: 3 }

		expect(parseCounters([good, null, 'x', { day: '20.11.2026', metric: 'a', value: 1 }, { day: TODAY, metric: 4, value: 1 }, { day: TODAY, metric: 'a', value: 1.5 }])).toEqual([good])
	})
})

describe('periodNumbers', () => {
	const counters = [
		{ day: '2026-10-01', metric: METRIC.decided, value: 50 },
		{ day: '2026-11-01', metric: METRIC.decided, value: 59 },
		{ day: TODAY, metric: METRIC.decided, value: 59 },
		{ day: TODAY, metric: METRIC.trashPictures, value: 4 },
		{ day: TODAY, metric: METRIC.trashBytes, value: 4000 },
		{ day: TODAY, metric: METRIC.deletedPictures, value: 1 },
		{ day: TODAY, metric: METRIC.deletedBytes, value: 500 },
		{ day: TODAY, metric: METRIC.sidecarsCreated, value: 7 },
		{ day: TODAY, metric: METRIC.sidecarsUpdated, value: 3 },
		{ day: TODAY, metric: METRIC.sidecarsForeign, value: 2 },
		{ day: TODAY, metric: METRIC.activeSeconds, value: 600 },
		{ day: TODAY, metric: METRIC.seriesDone, value: 5 },
		{ day: TODAY, metric: METRIC.rawsRemoved, value: 9 },
	]

	// spec: STATS-001.21, STATS-001.41
	it('sums the tiles and the line of the period and compares pictures decided with the period before', () => {
		const numbers = periodNumbers(counters, 'month', TODAY, '2026-10-01')

		expect(numbers).toMatchObject({
			decided: 118,
			decidedChange: 136,
			trashed: 4,
			freedBytes: 4500,
			deletedForGood: 1,
			sidecarsCreated: 7,
			sidecarsUpdated: 3,
			sidecarsForeign: 2,
			activeMs: 600_000,
			perMinute: 11.8,
			seriesDone: 5,
			rawsRemoved: 9,
		})
		expect(numbers.bars).toHaveLength(5)
	})

	// spec: STATS-001.41
	it('adds no change for all time, nor without numbers before', () => {
		expect(periodNumbers(counters, 'all', TODAY, '2026-10-01').decidedChange).toBeNull()
		expect(periodNumbers(counters, 'week', TODAY, '2026-10-01').decidedChange).toBeNull()
	})
})
