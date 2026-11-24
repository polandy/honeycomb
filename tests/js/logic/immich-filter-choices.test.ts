// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichCounts } from '../../../src/logic/immich-counts.ts'

import { describe, expect, it } from 'vitest'
import { deviceChoices, filterChoices, isDefaultImmichFilters, kindChoices } from '../../../src/logic/immich-filter-choices.ts'
import { defaultImmichFilters, timeOptions } from '../../../src/logic/immich-filters.ts'
import { NOW, UTC_CALENDAR } from './immich-fixtures.ts'

const DEFAULTS = defaultImmichFilters(NOW, UTC_CALENDAR)
const NO_UPLOADS: ImmichCounts = { total: 0, undecided: 0, decided: 0, matching: 0, flags: { picked: 0, rejected: 0, unflagged: 0 }, ratings: {}, colourLabels: {}, devices: [], kinds: { photo: 0, live: 0, video: 0 }, periods: Array.from({ length: 14 }, () => 0) }
const COUNTS: ImmichCounts = { ...NO_UPLOADS, total: 9, devices: [{ model: 'Pixel 9 Pro', count: 5 }, { model: 'SM-S918B', count: 3 }, { model: null, count: 1 }], kinds: { photo: 6, live: 2, video: 1 } }

describe('deviceChoices', () => {
	// spec: IMMICH-002.30
	it('lists the counted models in the server\'s order with their counts', () => {
		expect(deviceChoices(COUNTS, [], new Set())).toEqual([{ value: 'Pixel 9 Pro', count: 5 }, { value: 'SM-S918B', count: 3 }, { value: null, count: 1 }])
	})

	// spec: IMMICH-002.33
	it('lists nothing without uploads, but a chosen model the counts do not list, counted 0', () => {
		expect(deviceChoices(NO_UPLOADS, ['Pixel 9 Pro'], new Set())).toEqual([])
		expect(deviceChoices(NO_UPLOADS, [], new Set(['iPhone 12']))).toEqual([{ value: 'iPhone 12', count: 0 }])
	})

	// spec: IMMICH-002.33
	it('keeps the last answer\'s models and the chosen ones without numbers while counting', () => {
		expect(deviceChoices(null, ['Pixel 9 Pro', null], new Set(['iPhone 12', null]))).toEqual([{ value: 'Pixel 9 Pro', count: null }, { value: null, count: null }, { value: 'iPhone 12', count: null }])
	})
})

describe('kindChoices', () => {
	// spec: IMMICH-002.30, IMMICH-002.33
	it('lists photos, motion photos and videos with their counts, none while counting', () => {
		expect(kindChoices(COUNTS)).toEqual([{ value: 'photo', count: 6 }, { value: 'live', count: 2 }, { value: 'video', count: 1 }])
		expect(kindChoices(NO_UPLOADS).map(({ count }) => count)).toEqual([0, 0, 0])
		expect(kindChoices(null).map(({ count }) => count)).toEqual([null, null, null])
	})
})

describe('filterChoices', () => {
	// spec: IMMICH-002.33
	it('shows the last seven days, the current and the chosen month and all uploads when nothing is uploaded', () => {
		const filters = { ...DEFAULTS, time: { kind: 'month', year: 2026, month: 9 } } as const

		const { times, devices, kinds } = filterChoices(filters, NO_UPLOADS, timeOptions(NOW, UTC_CALENDAR), [], NOW, UTC_CALENDAR)

		expect(times.map(({ option }) => option)).toEqual([{ kind: 'last-7-days' }, { kind: 'month', year: 2026, month: 11 }, { kind: 'month', year: 2026, month: 9 }, { kind: 'all' }])
		expect(times.every(({ count }) => count === 0)).toBe(true)
		expect(devices).toEqual([])
		expect(kinds).toHaveLength(3)
	})
})

describe('isDefaultImmichFilters', () => {
	// spec: IMMICH-002.31
	it('holds for the defaults only', () => {
		expect(isDefaultImmichFilters(DEFAULTS, NOW, UTC_CALENDAR)).toBe(true)
		expect(isDefaultImmichFilters({ ...DEFAULTS, comparison: 'exactly' }, NOW, UTC_CALENDAR)).toBe(true)
		expect(isDefaultImmichFilters({ ...DEFAULTS, time: { kind: 'all' } }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, time: { kind: 'month', year: 2026, month: 10 } }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, devices: new Set([null]) }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, kinds: new Set(['video']) }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, flags: new Set(['picked']) }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, rating: 0 }, NOW, UTC_CALENDAR)).toBe(false)
		expect(isDefaultImmichFilters({ ...DEFAULTS, colourLabels: new Set(['red']) }, NOW, UTC_CALENDAR)).toBe(false)
	})
})
