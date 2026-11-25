// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PeriodBounds } from '../../../src/logic/stats-period.ts'

import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { canStep, comparedRange, holdsToday, periodAt, periodBars, periodNumbers, periodRun, stepAnchor } from '../../../src/logic/stats-period.ts'

const TODAY = '2026-11-26'
const SUNDAY = 0
const MONDAY = 1
const BOUNDS: PeriodBounds = { today: TODAY, firstDay: '2025-03-14', firstWeekDay: MONDAY }

const range = (kind: Parameters<typeof periodAt>[0], day: string, bounds = BOUNDS) => periodAt(kind, day, bounds).range

describe('periodAt', () => {
	// spec: STATS-001.21
	it('is the calendar month, year and all time from the first counted day to today', () => {
		expect(range('month', TODAY)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
		expect(range('year', TODAY)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
		expect(range('all', '2025-06-01')).toEqual({ from: '2025-03-14', to: TODAY })
	})

	// spec: STATS-001.21
	it('ends each month on its last day: 31, 30, 28 and 29 in a leap year', () => {
		expect(range('month', '2026-01-15').to).toBe('2026-01-31')
		expect(range('month', '2026-04-30').to).toBe('2026-04-30')
		expect(range('month', '2026-02-01').to).toBe('2026-02-28')
		expect(range('month', '2028-02-10').to).toBe('2028-02-29')
	})

	// spec: STATS-001.53
	it('starts the week on the first day of the locale, Monday or Sunday', () => {
		expect(range('week', TODAY)).toEqual({ from: '2026-11-23', to: '2026-11-29' })
		expect(range('week', TODAY, { ...BOUNDS, firstWeekDay: SUNDAY })).toEqual({ from: '2026-11-22', to: '2026-11-28' })
		expect(range('week', '2026-11-22')).toEqual({ from: '2026-11-16', to: '2026-11-22' })
		expect(range('week', '2026-11-22', { ...BOUNDS, firstWeekDay: SUNDAY })).toEqual({ from: '2026-11-22', to: '2026-11-28' })
	})

	// spec: STATS-001.53
	it('lets a week run across the turn of the year', () => {
		expect(range('week', '2027-01-01')).toEqual({ from: '2026-12-28', to: '2027-01-03' })
	})

	it('starts all time today without a counted day', () => {
		expect(range('all', TODAY, { ...BOUNDS, firstDay: null })).toEqual({ from: TODAY, to: TODAY })
	})
})

describe('stepping', () => {
	// spec: STATS-001.52
	it('steps to the period before and after, across a turn of the year', () => {
		expect(stepAnchor(periodAt('month', '2026-01-10', BOUNDS), -1, BOUNDS)).toBe('2025-12-01')
		expect(stepAnchor(periodAt('month', '2025-12-31', BOUNDS), 1, BOUNDS)).toBe('2026-01-01')
		expect(stepAnchor(periodAt('week', TODAY, BOUNDS), -1, BOUNDS)).toBe('2026-11-16')
		expect(stepAnchor(periodAt('year', '2025-06-01', BOUNDS), 1, BOUNDS)).toBe('2026-01-01')
	})

	// spec: STATS-001.52
	it('keeps the day stepped to inside the first counted day and today', () => {
		expect(stepAnchor(periodAt('year', TODAY, BOUNDS), -1, BOUNDS)).toBe('2025-03-14')
		expect(stepAnchor(periodAt('month', '2025-04-02', BOUNDS), -1, BOUNDS)).toBe('2025-03-14')
		expect(stepAnchor(periodAt('month', '2026-10-31', BOUNDS), 1, BOUNDS)).toBe('2026-11-01')
	})

	// spec: STATS-001.52
	it('keeps a month when the segment goes to the year and back', () => {
		const march = stepAnchor(periodAt('month', '2025-04-10', BOUNDS), -1, BOUNDS)

		expect(range('year', march)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
		expect(range('month', march)).toEqual({ from: '2025-03-01', to: '2025-03-31' })
	})

	// spec: STATS-001.52
	it('stops after the period of today and before the period of the first counted day', () => {
		expect(canStep(periodAt('month', TODAY, BOUNDS), 1, BOUNDS)).toBe(false)
		expect(canStep(periodAt('month', TODAY, BOUNDS), -1, BOUNDS)).toBe(true)
		expect(canStep(periodAt('month', '2026-10-31', BOUNDS), 1, BOUNDS)).toBe(true)
		expect(canStep(periodAt('month', '2025-03-20', BOUNDS), -1, BOUNDS)).toBe(false)
		expect(canStep(periodAt('month', '2025-04-01', BOUNDS), -1, BOUNDS)).toBe(true)
		expect(canStep(periodAt('week', '2025-03-14', BOUNDS), -1, BOUNDS)).toBe(false)
	})

	// spec: STATS-001.52
	it('never steps all time, nor before today without a counted day', () => {
		expect(canStep(periodAt('all', TODAY, BOUNDS), -1, BOUNDS)).toBe(false)
		expect(canStep(periodAt('all', TODAY, BOUNDS), 1, BOUNDS)).toBe(false)
		const nothing = { ...BOUNDS, firstDay: null }
		expect(canStep(periodAt('month', TODAY, nothing), -1, nothing)).toBe(false)
	})

	// spec: STATS-001.52
	it('knows the period of today', () => {
		expect(holdsToday(periodAt('week', TODAY, BOUNDS), TODAY)).toBe(true)
		expect(holdsToday(periodAt('week', '2026-11-22', BOUNDS), TODAY)).toBe(false)
		expect(holdsToday(periodAt('year', '2025-12-31', BOUNDS), TODAY)).toBe(false)
	})
})

describe('comparedRange', () => {
	// spec: STATS-001.41
	it('compares the period of today up to the same day of the period before', () => {
		expect(comparedRange(periodAt('month', TODAY, BOUNDS), BOUNDS)).toEqual({ range: { from: '2026-10-01', to: '2026-10-26' }, whole: false })
		expect(comparedRange(periodAt('week', TODAY, BOUNDS), BOUNDS)).toEqual({ range: { from: '2026-11-16', to: '2026-11-19' }, whole: false })
		expect(comparedRange(periodAt('year', TODAY, BOUNDS), BOUNDS)).toEqual({ range: { from: '2025-01-01', to: '2025-11-26' }, whole: false })
	})

	// spec: STATS-001.41
	it('cuts the same day to the end of a shorter month before', () => {
		expect(comparedRange(periodAt('month', '2026-03-31', BOUNDS), { ...BOUNDS, today: '2026-03-31' })?.range).toEqual({ from: '2026-02-01', to: '2026-02-28' })
	})

	// spec: STATS-001.41
	it('compares a past period with the whole period before, and all time with nothing', () => {
		expect(comparedRange(periodAt('month', '2026-03-05', BOUNDS), BOUNDS)).toEqual({ range: { from: '2026-02-01', to: '2026-02-28' }, whole: true })
		expect(comparedRange(periodAt('all', TODAY, BOUNDS), BOUNDS)).toBeNull()
	})
})

describe('periodBars', () => {
	const counters = [
		{ day: '2025-03-14', metric: METRIC.decided, value: 4 },
		{ day: '2026-11-02', metric: METRIC.decided, value: 3 },
		{ day: '2026-11-02', metric: METRIC.trashPictures, value: 1 },
		{ day: TODAY, metric: METRIC.decided, value: 5 },
	]
	const bars = (kind: Parameters<typeof periodAt>[0], day: string, bounds = BOUNDS) => periodBars(counters, periodAt(kind, day, bounds), bounds)

	// spec: STATS-001.21
	it('splits a week and a month per day', () => {
		expect(bars('week', TODAY).bars.map((bar) => bar.range.from)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', TODAY, '2026-11-27', '2026-11-28', '2026-11-29'])
		const month = bars('month', TODAY)
		expect(month.unit).toBe('day')
		expect(month.bars).toHaveLength(30)
		expect(month.bars[1]).toEqual({ range: { from: '2026-11-02', to: '2026-11-02' }, decided: 3, trashed: 1, future: false, beforeFirst: false, today: false })
		expect(bars('month', '2028-02-01').bars).toHaveLength(29)
	})

	// spec: STATS-001.21
	it('splits a year per month', () => {
		const year = bars('year', TODAY)

		expect(year.unit).toBe('month')
		expect(year.bars.map((bar) => bar.range.from.slice(5, 7))).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'])
		expect(year.bars[10]).toMatchObject({ range: { from: '2026-11-01', to: '2026-11-30' }, decided: 8, trashed: 1, today: true })
	})

	// spec: STATS-001.21
	it('splits all time per year from two calendar years on', () => {
		const all = bars('all', TODAY)

		expect(all.unit).toBe('year')
		expect(all.bars.map((bar) => bar.range)).toEqual([{ from: '2025-01-01', to: '2025-12-31' }, { from: '2026-01-01', to: '2026-12-31' }])
		expect(all.bars.map((bar) => bar.decided)).toEqual([4, 8])
	})

	// spec: STATS-001.21
	it('splits all time per month while the counting lies in one calendar year', () => {
		const bounds = { ...BOUNDS, firstDay: '2026-09-20' }
		const all = bars('all', TODAY, bounds)

		expect(all.unit).toBe('month')
		expect(all.bars.map((bar) => bar.range.from)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
	})

	// spec: STATS-001.54
	it('marks the days after today as to come and outlines today', () => {
		const week = bars('week', TODAY).bars

		expect(week.map((bar) => bar.future)).toEqual([false, false, false, false, true, true, true])
		expect(week.map((bar) => bar.today)).toEqual([false, false, false, true, false, false, false])
		expect(bars('year', TODAY).bars.filter((bar) => bar.future).map((bar) => bar.range.from)).toEqual(['2026-12-01'])
	})

	// spec: STATS-001.54
	it('marks the days before the first counted day, and outlines nothing under all time', () => {
		const march = bars('month', '2025-03-14').bars

		expect(march.filter((bar) => bar.beforeFirst)).toHaveLength(13)
		expect(march[13]).toMatchObject({ beforeFirst: false, decided: 4 })
		expect(bars('all', TODAY).bars.some((bar) => bar.today)).toBe(false)
	})
})

describe('periodRun', () => {
	const active = (day: string) => ({ day, metric: METRIC.decided, value: 1 })
	const counters = [active('2026-10-04'), active('2026-10-05'), active('2026-10-06'), active('2026-10-30'), active('2026-10-31'), active('2026-11-01'), active('2026-11-02'), active('2026-11-25'), active(TODAY)]

	// spec: STATS-001.56
	it('is the longest run inside a past period, cut at its ends', () => {
		expect(periodRun(counters, periodAt('month', '2026-10-01', BOUNDS), TODAY)).toEqual({ days: 3, longest: null })
		expect(periodRun(counters, periodAt('week', '2026-09-01', BOUNDS), TODAY)).toEqual({ days: 0, longest: null })
	})

	// spec: STATS-001.56, STATS-001.22
	it('is the streak and the longest run in the period of today and under all time', () => {
		expect(periodRun(counters, periodAt('month', TODAY, BOUNDS), TODAY)).toEqual({ days: 2, longest: 4 })
		expect(periodRun(counters, periodAt('all', TODAY, BOUNDS), TODAY)).toEqual({ days: 2, longest: 4 })
	})
})

describe('periodNumbers', () => {
	const counters = [
		{ day: '2026-10-01', metric: METRIC.decided, value: 50 },
		{ day: '2026-10-30', metric: METRIC.decided, value: 1000 },
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
	it('sums the tiles and the line of the period and compares pictures decided up to the same day before', () => {
		const numbers = periodNumbers(counters, periodAt('month', TODAY, BOUNDS), BOUNDS)

		expect(numbers).toMatchObject({
			decided: 118,
			decidedChange: 136,
			compared: { range: { from: '2026-10-01', to: '2026-10-26' }, whole: false },
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
			unit: 'day',
		})
		expect(numbers.bars).toHaveLength(30)
	})

	// spec: STATS-001.41, STATS-001.55
	it('adds no change for all time, nor without numbers before', () => {
		expect(periodNumbers(counters, periodAt('all', TODAY, BOUNDS), BOUNDS)).toMatchObject({ decidedChange: null, compared: null })
		expect(periodNumbers(counters, periodAt('month', '2026-09-10', BOUNDS), BOUNDS)).toMatchObject({ decided: 0, decidedChange: null })
	})
})
