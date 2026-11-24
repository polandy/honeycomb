// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichFilters } from '../../../src/logic/immich-filters.ts'

import { describe, expect, it } from 'vitest'
import { readImmichFilters, storedFiltersOf, storedImmichFilters } from '../../../src/logic/immich-filter-storage.ts'
import { defaultImmichFilters } from '../../../src/logic/immich-filters.ts'
import { NOW, UTC_CALENDAR } from './immich-fixtures.ts'

const DEFAULTS = defaultImmichFilters(NOW, UTC_CALENDAR)
/** The first of January 2027, a month after NOW. */
const NEXT_YEAR = Date.UTC(2027, 0, 1) / 1000
const CHOSEN: ImmichFilters = { time: { kind: 'month', year: 2026, month: 10 }, devices: new Set(['Pixel 9 Pro', null]), kinds: new Set(['video']), flags: new Set(['rejected']), rating: 3, comparison: 'exactly', colourLabels: new Set(['red']) }

describe('storedImmichFilters and readImmichFilters', () => {
	// spec: IMMICH-002.32
	it('reads back the filters it stored', () => {
		const stored = JSON.parse(JSON.stringify(storedImmichFilters(CHOSEN, NOW, UTC_CALENDAR)))

		expect(readImmichFilters(stored, NOW, UTC_CALENDAR)).toEqual(CHOSEN)
	})

	// spec: IMMICH-002.32
	it('stores the current month as the current one, so it follows the calendar', () => {
		const stored = storedImmichFilters(DEFAULTS, NOW, UTC_CALENDAR)

		expect(stored.time).toBe('current')
		expect(readImmichFilters(stored, NEXT_YEAR, UTC_CALENDAR).time).toEqual({ kind: 'month', year: 2027, month: 1 })
	})

	// spec: IMMICH-002.32
	it('keeps the last seven days and all uploads', () => {
		for (const time of [{ kind: 'last-7-days' }, { kind: 'all' }] as const) {
			const stored = storedImmichFilters({ ...DEFAULTS, time }, NOW, UTC_CALENDAR)
			expect(readImmichFilters(stored, NOW, UTC_CALENDAR).time).toEqual(time)
		}
	})

	// spec: IMMICH-002.32
	it('takes the defaults for nothing stored or anything but an object', () => {
		for (const stored of [null, undefined, 'all', 3, ['all']]) {
			expect(readImmichFilters(stored, NOW, UTC_CALENDAR)).toEqual(DEFAULTS)
		}
	})

	// spec: IMMICH-002.32
	it('takes the default of each value it cannot read', () => {
		const stored = { time: { year: 2024, month: 5 }, devices: 'Pixel', kinds: ['video', 'screenshot'], flags: 'picked', rating: 9, comparison: 'more', colourLabels: ['red', 'teal', 7] }

		expect(readImmichFilters(stored, NOW, UTC_CALENDAR)).toEqual({ ...DEFAULTS, kinds: new Set(['video']), colourLabels: new Set(['red']) })
	})

	// spec: IMMICH-002.32
	it('drops device entries that are neither a model nor no camera data, and keeps no flag pressed', () => {
		const stored = { devices: ['Pixel 9 Pro', null, 4, ''], flags: [], time: { year: 2026, month: 13 }, rating: 2.5 }

		expect(readImmichFilters(stored, NOW, UTC_CALENDAR)).toEqual({ ...DEFAULTS, devices: new Set(['Pixel 9 Pro', null]), flags: new Set() })
	})
})

describe('storedFiltersOf', () => {
	// spec: IMMICH-002.32
	it('finds the connection\'s stored filters in the view state, null without them', () => {
		const answer = { info_panel_open: true, immich_filters: { phone: { time: 'all' } } }

		expect(storedFiltersOf(answer, 'phone')).toEqual({ time: 'all' })
		expect(storedFiltersOf(answer, 'tablet')).toBeNull()
		expect(storedFiltersOf({ immich_filters: null }, 'phone')).toBeNull()
		expect(storedFiltersOf({ immich_filters: ['x'] }, '0')).toBeNull()
		expect(storedFiltersOf(null, 'phone')).toBeNull()
	})
})
