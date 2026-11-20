// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichFilters, TimeOption } from '../../../src/logic/immich-filters.ts'

import { describe, expect, it } from 'vitest'
import { browserCalendar, countsRequest, defaultImmichFilters, requestFilters, shownTimeOptions, timeOptions, timeRange } from '../../../src/logic/immich-filters.ts'
import { NOW, UTC_CALENDAR } from './immich-fixtures.ts'

const DAY = 86400
const month = (year: number, monthNumber: number): TimeOption => ({ kind: 'month', year, month: monthNumber })
const utc = (year: number, monthIndex: number) => Date.UTC(year, monthIndex, 1) / 1000

describe('defaultImmichFilters', () => {
	// spec: IMMICH-002.11
	it('chooses the current month, every device and kind, and the default flag filter', () => {
		const filters = defaultImmichFilters(NOW, UTC_CALENDAR)

		expect(filters.time).toEqual(month(2026, 11))
		expect(filters.devices.size).toBe(0)
		expect(filters.kinds.size).toBe(0)
		expect([...filters.flags]).toEqual(['picked', 'unflagged'])
		expect(filters.rating).toBeNull()
	})
})

describe('timeOptions', () => {
	// spec: IMMICH-002.26
	it('lists the last seven days, the current month and the eleven before it, and all uploads', () => {
		const options = timeOptions(NOW, UTC_CALENDAR)

		expect(options).toHaveLength(14)
		expect(options[0]).toEqual({ kind: 'last-7-days' })
		expect(options[1]).toEqual(month(2026, 11))
		expect(options[2]).toEqual(month(2026, 10))
		expect(options[12]).toEqual(month(2025, 12))
		expect(options[13]).toEqual({ kind: 'all' })
	})
})

describe('timeRange', () => {
	// spec: IMMICH-002.11
	it('bounds a month by its first second and the next month\'s, December into January', () => {
		expect(timeRange(month(2026, 10), NOW, UTC_CALENDAR)).toEqual({ takenAfter: utc(2026, 9), takenBefore: utc(2026, 10) })
		expect(timeRange(month(2025, 12), NOW, UTC_CALENDAR)).toEqual({ takenAfter: utc(2025, 11), takenBefore: utc(2026, 0) })
	})

	it('bounds the last seven days from now and leaves all uploads open', () => {
		expect(timeRange({ kind: 'last-7-days' }, NOW, UTC_CALENDAR)).toEqual({ takenAfter: NOW - 7 * DAY, takenBefore: null })
		expect(timeRange({ kind: 'all' }, NOW, UTC_CALENDAR)).toEqual({ takenAfter: null, takenBefore: null })
	})
})

describe('requestFilters', () => {
	// spec: IMMICH-002.12
	it('sends the chosen models with no camera data as null, the kinds and the time range', () => {
		const filters: ImmichFilters = {
			...defaultImmichFilters(NOW, UTC_CALENDAR),
			devices: new Set(['Pixel 9 Pro', null]),
			kinds: new Set(['video'] as const),
		}

		expect(requestFilters(filters, NOW, UTC_CALENDAR)).toEqual({
			takenAfter: utc(2026, 10),
			takenBefore: utc(2026, 11),
			devices: ['Pixel 9 Pro', null],
			kinds: ['video'],
			flags: ['picked', 'unflagged'],
			rating: null,
			colourLabels: [],
		})
	})

	it('names the rating comparison as the server does', () => {
		const base = defaultImmichFilters(NOW, UTC_CALENDAR)
		const rated = (comparison: ImmichFilters['comparison']) => requestFilters({ ...base, rating: 2, comparison, colourLabels: new Set(['red'] as const) }, NOW, UTC_CALENDAR)

		expect(rated('at-least').rating).toEqual({ op: 'atLeast', value: 2 })
		expect(rated('at-most').rating).toEqual({ op: 'atMost', value: 2 })
		expect(rated('exactly').rating).toEqual({ op: 'exactly', value: 2 })
		expect(rated('exactly').colourLabels).toEqual(['red'])
	})
})

describe('countsRequest', () => {
	// spec: IMMICH-002.26
	it('counts every time option under the filters', () => {
		const filters = defaultImmichFilters(NOW, UTC_CALENDAR)
		const options = timeOptions(NOW, UTC_CALENDAR)
		const request = countsRequest(filters, options, NOW, UTC_CALENDAR)

		expect(request.filters).toEqual(requestFilters(filters, NOW, UTC_CALENDAR))
		expect(request.periods).toHaveLength(14)
		expect(request.periods[0]).toEqual({ takenAfter: NOW - 7 * DAY, takenBefore: null })
		expect(request.periods[1]).toEqual({ takenAfter: utc(2026, 10), takenBefore: utc(2026, 11) })
		expect(request.periods[13]).toEqual({ takenAfter: null, takenBefore: null })
	})
})

describe('shownTimeOptions', () => {
	const options = timeOptions(NOW, UTC_CALENDAR)
	const counts = options.map((option) => option.kind === 'month' && option.month === 9 ? 4 : 0)

	// spec: IMMICH-002.26
	it('shows the months with uploads, the current month, and the last seven days and all uploads always', () => {
		const shown = shownTimeOptions(options, counts, month(2026, 11), NOW, UTC_CALENDAR)

		expect(shown).toEqual([
			{ option: { kind: 'last-7-days' }, count: 0 },
			{ option: month(2026, 11), count: 0 },
			{ option: month(2026, 9), count: 4 },
			{ option: { kind: 'all' }, count: 0 },
		])
	})

	// spec: IMMICH-002.26
	it('keeps an empty month while it is chosen', () => {
		const shown = shownTimeOptions(options, counts, month(2026, 3), NOW, UTC_CALENDAR)

		expect(shown.map((item) => item.option)).toContainEqual(month(2026, 3))
	})

	it('shows no count until the counts arrive', () => {
		const shown = shownTimeOptions(options, null, month(2026, 11), NOW, UTC_CALENDAR)

		expect(shown).toHaveLength(14)
		expect(shown[0]).toEqual({ option: { kind: 'last-7-days' }, count: null })
	})
})

describe('browserCalendar', () => {
	it('finds each month again from its first second, in any time zone', () => {
		for (const [year, monthNumber] of [[2025, 12], [2026, 1], [2026, 3], [2026, 10], [2026, 11]] as const) {
			expect(browserCalendar.monthOf(browserCalendar.monthStart(year, monthNumber))).toEqual({ year, month: monthNumber })
			expect(browserCalendar.monthOf(browserCalendar.monthStart(year, monthNumber) - 1)).not.toEqual({ year, month: monthNumber })
		}
	})
})
