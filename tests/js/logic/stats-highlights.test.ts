// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { periodHighlights } from '../../../src/logic/stats-highlights.ts'
import { periodAt } from '../../../src/logic/stats-period.ts'

const SUNDAY = 0
const MONDAY = 1
const bounds = (firstWeekDay = MONDAY, firstDay: string | null = '2026-10-01') => ({ today: '2026-11-26', firstDay, firstWeekDay })
const decided = (day: string, value: number, seconds = 0) => [
	{ day, metric: METRIC.decided, value },
	{ day, metric: METRIC.activeSeconds, value: seconds },
]
const november = (counters: ReturnType<typeof decided>, firstWeekDay = MONDAY) => periodHighlights(counters, periodAt('month', '2026-11-10', bounds(firstWeekDay)), bounds(firstWeekDay))

describe('periodHighlights', () => {
	// spec: STATS-001.67
	it('has no highlights in a period without a counter', () => {
		expect(november(decided('2026-10-05', 9))).toBeNull()
	})

	// spec: STATS-001.68
	it('names the day with the most pictures decided with its count and active time', () => {
		const counters = [...decided('2026-11-02', 40, 600), ...decided('2026-11-24', 86, 1260), ...decided('2026-11-25', 20, 60)]

		expect(november(counters)!.bestDay).toEqual({ day: '2026-11-24', decided: 86, activeSeconds: 1260 })
	})

	// spec: STATS-001.68
	it('takes the earlier day when two days tie and none without a decision', () => {
		const tie = [...decided('2026-11-09', 50), ...decided('2026-11-03', 50)]
		const none = [{ day: '2026-11-03', metric: METRIC.trashBytes, value: 5 }]

		expect(november(tie)!.bestDay!.day).toBe('2026-11-03')
		expect(november(none)!.bestDay).toBeNull()
	})

	// spec: STATS-001.69
	it('averages the pictures decided per weekday over the days up to today, from the locale week start', () => {
		// Mondays in November up to the 26th: 2, 9, 16, 23; Thursdays: 5, 12, 19, 26.
		const counters = [...decided('2026-11-02', 80), ...decided('2026-11-09', 40), ...decided('2026-11-26', 20)]
		const monday = november(counters, MONDAY)!.busiestWeekday!
		const sunday = november(counters, SUNDAY)!.busiestWeekday!

		expect(monday.weekday).toBe(MONDAY)
		expect(monday.days.map((each) => each.weekday)).toEqual([1, 2, 3, 4, 5, 6, 0])
		expect(monday.days[0]).toEqual({ weekday: MONDAY, average: 30 })
		expect(monday.days[3]).toEqual({ weekday: 4, average: 5 })
		expect(sunday.days.map((each) => each.weekday)).toEqual([0, 1, 2, 3, 4, 5, 6])
	})

	// spec: STATS-001.69
	it('starts the weekday averages on the first counted day and takes the first weekday of the week on a tie', () => {
		const counters = [...decided('2026-11-04', 10), ...decided('2026-11-03', 10)]
		const late = periodHighlights(counters, periodAt('month', '2026-11-10', bounds(MONDAY, '2026-11-03')), bounds(MONDAY, '2026-11-03'))!.busiestWeekday!

		// Tuesdays 3, 10, 17, 24 and Wednesdays 4, 11, 18, 25 both average 2.5; Tuesday comes first.
		expect(late.weekday).toBe(2)
		expect(late.days.find((each) => each.weekday === 2)!.average).toBe(2.5)
		expect(late.days.find((each) => each.weekday === MONDAY)!.average).toBe(0)
	})

	// spec: STATS-001.69
	it('has no busiest weekday without a decision', () => {
		expect(november([{ day: '2026-11-03', metric: METRIC.trashBytes, value: 5 }])!.busiestWeekday).toBeNull()
	})

	// spec: STATS-001.69
	it('compares the pace with the days compared with, none when either has no pace', () => {
		const counters = [...decided('2026-11-02', 90, 600), ...decided('2026-10-02', 60, 600)]
		const both = november(counters)!.pace
		const before = november(decided('2026-11-02', 90, 600))!.pace

		expect(both).toEqual({ pace: 9, before: 6 })
		expect(before).toEqual({ pace: 9, before: null })
		expect(november(decided('2026-11-02', 90, 30))!.pace).toEqual({ pace: null, before: null })
	})

	// spec: STATS-001.69
	it('counts the active days of the days up to today and from the first counted day on', () => {
		const counters = [...decided('2026-11-02', 5), ...decided('2026-11-03', 5), ...decided('2026-11-03', 5)]

		expect(november(counters)!.activeDays).toEqual({ active: 2, days: 26 })
		const all = periodHighlights(counters, periodAt('all', '2026-11-26', bounds()), bounds())!
		expect(all.activeDays).toEqual({ active: 2, days: 57 })
	})

	// spec: STATS-001.69
	it('finds the longest run of days with a counter inside the period, the earlier run on a tie', () => {
		const counters = ['2026-11-03', '2026-11-04', '2026-11-10', '2026-11-11', '2026-10-31', '2026-11-01'].flatMap((day) => decided(day, 1))

		expect(november(counters)!.longestStreak).toEqual({ length: 2, from: '2026-11-03', to: '2026-11-04' })
	})

	// spec: STATS-001.69
	it('has a streak of one day for a single active day', () => {
		expect(november(decided('2026-11-03', 1))!.longestStreak).toEqual({ length: 1, from: '2026-11-03', to: '2026-11-03' })
	})
})
