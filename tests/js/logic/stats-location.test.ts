// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { PeriodBounds } from '../../../src/logic/stats-period.ts'

import { describe, expect, it } from 'vitest'
import { parsePeriodHash, periodHash, resolveLocation } from '../../../src/logic/stats-location.ts'
import { periodAt } from '../../../src/logic/stats-period.ts'

const BOUNDS: PeriodBounds = { today: '2026-11-26', firstDay: '2025-03-14', firstWeekDay: 1 }

describe('parsePeriodHash', () => {
	// spec: STATS-001.58
	it('reads a week, month, year and all time, and the bare names as the period of today', () => {
		expect(parsePeriodHash('#week=2026-11-18')).toEqual({ kind: 'week', day: '2026-11-18' })
		expect(parsePeriodHash('#month=2025-07')).toEqual({ kind: 'month', day: '2025-07-01' })
		expect(parsePeriodHash('#year=2025')).toEqual({ kind: 'year', day: '2025-01-01' })
		expect(parsePeriodHash('#all')).toEqual({ kind: 'all', day: null })
		expect(parsePeriodHash('#week')).toEqual({ kind: 'week', day: null })
		expect(parsePeriodHash('#month')).toEqual({ kind: 'month', day: null })
		expect(parsePeriodHash('#year')).toEqual({ kind: 'year', day: null })
	})

	// spec: STATS-001.58
	it.each([
		'',
		'#',
		'#foo',
		'#cull=1',
		'#month=2026-13',
		'#month=2026-00',
		'#month=2026-7',
		'#month=2026-07-01',
		'#week=2026-02-30',
		'#week=2026-11',
		'#week=2026-11-18x',
		'#year=26',
		'#year=abcd',
		'#year=2025-01',
		'#all=1',
		'#month=',
		'month=2025-07',
	])('names no period for %j', (hash) => {
		expect(parsePeriodHash(hash)).toBeNull()
	})

	// spec: STATS-001.58
	it('accepts the 29th of February only in a leap year', () => {
		expect(parsePeriodHash('#week=2024-02-29')).toEqual({ kind: 'week', day: '2024-02-29' })
		expect(parsePeriodHash('#week=2025-02-29')).toBeNull()
	})
})

describe('resolveLocation', () => {
	// spec: STATS-001.58
	it('shows the month of today without a valid location', () => {
		expect(resolveLocation(null, BOUNDS)).toEqual({ kind: 'month', anchor: null })
	})

	// spec: STATS-001.58
	it('keeps a day inside the counted days and the bare names on today', () => {
		expect(resolveLocation({ kind: 'month', day: '2025-07-01' }, BOUNDS)).toEqual({ kind: 'month', anchor: '2025-07-01' })
		expect(resolveLocation({ kind: 'week', day: null }, BOUNDS)).toEqual({ kind: 'week', anchor: null })
		expect(resolveLocation({ kind: 'all', day: null }, BOUNDS)).toEqual({ kind: 'all', anchor: null })
	})

	// spec: STATS-001.58
	it('shows today for a period after today, also the period of today named by its first day', () => {
		expect(resolveLocation({ kind: 'month', day: '2027-01-01' }, BOUNDS)).toEqual({ kind: 'month', anchor: null })
		expect(resolveLocation({ kind: 'month', day: '2026-11-01' }, BOUNDS)).toEqual({ kind: 'month', anchor: null })
		expect(resolveLocation({ kind: 'year', day: '2026-01-01' }, BOUNDS)).toEqual({ kind: 'year', anchor: null })
	})

	// spec: STATS-001.58
	it('shows the first counted day for a period before it, and today without any counted day', () => {
		expect(resolveLocation({ kind: 'month', day: '2020-01-01' }, BOUNDS)).toEqual({ kind: 'month', anchor: '2025-03-14' })
		expect(resolveLocation({ kind: 'year', day: '2025-01-01' }, BOUNDS)).toEqual({ kind: 'year', anchor: '2025-03-14' })
		expect(resolveLocation({ kind: 'month', day: '2020-01-01' }, { ...BOUNDS, firstDay: null })).toEqual({ kind: 'month', anchor: null })
	})
})

describe('periodHash', () => {
	const hash = (kind: Parameters<typeof periodAt>[0], day: string) => periodHash(periodAt(kind, day, BOUNDS), BOUNDS.today)

	// spec: STATS-001.57
	it('has no hash for the month of today and the bare name for the week and year of today', () => {
		expect(hash('month', '2026-11-26')).toBe('')
		expect(hash('week', '2026-11-26')).toBe('#week')
		expect(hash('year', '2026-11-26')).toBe('#year')
	})

	// spec: STATS-001.57
	it('names a past period by its first day, month or year, zero padded', () => {
		expect(hash('week', '2026-11-19')).toBe('#week=2026-11-16')
		expect(hash('month', '2025-07-15')).toBe('#month=2025-07')
		expect(hash('month', '2025-12-31')).toBe('#month=2025-12')
		expect(hash('year', '2025-06-01')).toBe('#year=2025')
		expect(hash('week', '2026-01-01')).toBe('#week=2025-12-29')
	})

	// spec: STATS-001.57
	it('names all time', () => {
		expect(hash('all', '2026-11-26')).toBe('#all')
	})

	// spec: STATS-001.57, STATS-001.58
	it.each([['week', '2026-03-04'], ['month', '2025-07-15'], ['year', '2025-06-01'], ['all', '2025-06-01'], ['month', '2026-11-26'], ['week', '2026-11-26']] as const)('round-trips a %s of %s through parse and resolve', (kind, day) => {
		const period = periodAt(kind, day, BOUNDS)
		const { kind: back, anchor } = resolveLocation(parsePeriodHash(periodHash(period, BOUNDS.today)), BOUNDS)

		expect(periodAt(back, anchor ?? BOUNDS.today, BOUNDS)).toEqual(period)
	})
})
