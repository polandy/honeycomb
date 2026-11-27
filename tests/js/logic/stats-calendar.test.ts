// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Counter } from '../../../src/logic/statistics.ts'
import type { PeriodBounds, PeriodKind } from '../../../src/logic/stats-period.ts'

import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { periodCalendar } from '../../../src/logic/stats-calendar.ts'
import { periodAt } from '../../../src/logic/stats-period.ts'

const decided = (day: string, value: number): Counter => ({ day, metric: METRIC.decided, value })
const bounds = (today: string, firstDay: string | null, firstWeekDay = 1): PeriodBounds => ({ today, firstDay, firstWeekDay })
const calendar = (kind: PeriodKind, day: string, counters: Counter[], at: PeriodBounds) => periodCalendar(counters, periodAt(kind, day, at), at)

describe('periodCalendar of a month', () => {
	const at = bounds('2026-11-26', '2026-10-01')
	const counters = [decided('2026-11-02', 30), decided('2026-11-10', 90), decided('2026-11-11', 60)]

	// spec: STATS-001.70
	it('has one square per day with the level against the busiest day, after the empty places of the first weekday', () => {
		const shown = calendar('month', '2026-11-15', counters, at)

		expect(shown.layout).toBe('days')
		expect(shown.unit).toBe('day')
		expect(shown.groups).toHaveLength(1)
		expect(shown.groups[0]!.squares).toHaveLength(30)
		expect(shown.groups[0]!.lead).toBe(6)
		expect(shown.groups[0]!.squares.filter((each) => each.level > 0).map((each) => [each.bar.range.from, each.level])).toEqual([['2026-11-02', 1], ['2026-11-10', 3], ['2026-11-11', 2]])
	})

	// spec: STATS-001.70
	it('starts a month that begins on a Sunday after no empty place with Sunday first and six with Monday first', () => {
		const sunday = bounds('2026-11-26', '2026-11-01', 0)
		const monday = bounds('2026-11-26', '2026-11-01', 1)

		expect(calendar('month', '2026-11-15', [], sunday).groups[0]!.lead).toBe(0)
		expect(calendar('month', '2026-11-15', [], monday).groups[0]!.lead).toBe(6)
		expect(calendar('month', '2026-11-15', [], sunday).weekDays).toEqual([0, 1, 2, 3, 4, 5, 6])
		expect(calendar('month', '2026-11-15', [], monday).weekDays).toEqual([1, 2, 3, 4, 5, 6, 0])
	})

	// spec: STATS-001.70
	it('marks the days to come, today and the days before the first counted day', () => {
		const first = bounds('2026-11-26', '2026-11-05')
		const squares = calendar('month', '2026-11-15', [decided('2026-11-05', 1)], first).groups[0]!.squares.map((each) => each.bar)

		expect(squares.filter((each) => each.future)).toHaveLength(4)
		expect(squares.filter((each) => each.beforeFirst)).toHaveLength(4)
		expect(squares.filter((each) => each.today).map((each) => each.range.from)).toEqual(['2026-11-26'])
	})

	// spec: STATS-001.70
	it('has level 0 everywhere without a counter', () => {
		expect(calendar('month', '2026-11-15', [], at).groups[0]!.squares.every((each) => each.level === 0)).toBe(true)
	})
})

describe('periodCalendar of a week', () => {
	// spec: STATS-001.70
	it('has seven squares from the first weekday, none empty before the first', () => {
		const at = bounds('2026-11-26', '2026-10-01')
		const shown = calendar('week', '2026-11-26', [decided('2026-11-24', 5)], at)

		expect(shown.groups[0]!.lead).toBe(0)
		expect(shown.groups[0]!.squares.map((each) => each.bar.range.from)).toEqual(['2026-11-23', '2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29'])
		expect(shown.groups[0]!.squares[1]!.level).toBe(3)
	})
})

describe('periodCalendar of a year', () => {
	const at = bounds('2026-11-26', '2025-03-14')

	// spec: STATS-001.70
	it('has the twelve months with their days, each with its own empty places', () => {
		const shown = calendar('year', '2026-06-01', [decided('2026-02-03', 10)], at)

		expect(shown.layout).toBe('year')
		expect(shown.groups.map((each) => each.anchor)).toEqual(['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map((month) => `2026-${month}-01`))
		expect(shown.groups.map((each) => each.squares.length)).toEqual([31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31])
		expect(shown.groups.map((each) => each.lead)).toEqual([3, 6, 6, 2, 4, 0, 2, 5, 1, 3, 6, 1])
	})

	// spec: STATS-001.70
	it('takes the level of every day from the busiest day of the year', () => {
		const shown = calendar('year', '2026-06-01', [decided('2026-02-03', 10), decided('2026-09-09', 100)], at)

		expect(shown.groups[1]!.squares[2]!.level).toBe(1)
		expect(shown.groups[8]!.squares[8]!.level).toBe(3)
	})
})

describe('periodCalendar of all time', () => {
	const at = bounds('2026-11-26', '2025-03-14')

	// spec: STATS-001.70
	it('has a row per year with a square per month, from the first counted year to the current one', () => {
		const shown = calendar('all', '2026-11-26', [decided('2025-03-14', 30), decided('2026-10-05', 90)], at)

		expect(shown.layout).toBe('all')
		expect(shown.unit).toBe('month')
		expect(shown.groups.map((each) => [each.anchor, each.lead, each.squares.length])).toEqual([['2025-01-01', 0, 12], ['2026-01-01', 0, 12]])
		expect(shown.groups[0]!.squares[2]!.level).toBe(1)
		expect(shown.groups[1]!.squares[9]!.level).toBe(3)
		expect(shown.groups[0]!.squares[1]!.bar.beforeFirst).toBe(true)
		expect(shown.groups[1]!.squares[11]!.bar.future).toBe(true)
	})

	// spec: STATS-001.70
	it('is one row when everything was counted in the current year', () => {
		const shown = calendar('all', '2026-11-26', [decided('2026-11-02', 1)], bounds('2026-11-26', '2026-11-02'))

		expect(shown.groups).toHaveLength(1)
	})
})
