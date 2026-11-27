// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Counter } from '../../../src/logic/statistics.ts'

import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { libraryCard } from '../../../src/logic/stats-library.ts'
import { doneRow, row } from './folder-fixtures.ts'

const TODAY = '2026-11-26'
/** The first of the 90 days up to today. */
const WINDOW_START = '2026-08-29'
const LONG_AGO = '2025-01-01'
const ROOTS = ['/Photos']
const decided = (day: string, value: number): Counter => ({ day, metric: METRIC.decided, value })
const added = (day: string, value: number): Counter => ({ day, metric: METRIC.photosAdded, value })
/** 900 decided and 180 added in the window: a net rate of 8 photos a day. */
const PACE = [decided(WINDOW_START, 400), decided(TODAY, 500)]
const INTAKE = [added('2026-10-01', 180)]
const undecidedRow = (undecided: number) => row({ photos: undecided, undecided, picked: 0, rejected: 0 })

/** The forecast for `undecided` photos at the counters and photos added given. */
function forecastOf(undecided: number, counters: readonly Counter[] = PACE, intake: readonly Counter[] = INTAKE, firstDay: string | null = LONG_AGO) {
	return libraryCard([undecidedRow(undecided)], ROOTS, { counters, today: TODAY, firstDay }, intake).forecast
}

describe('libraryCard', () => {
	// spec: STATS-001.42, STATS-001.85
	it('sums the progress, the photos undecided and the RAW bytes of the done folders below the roots', () => {
		const rows = [
			doneRow({ path: '/Photos/a', rawBytes: 3_000 }),
			row({ path: '/Photos/b', undecided: 40, rawBytes: 5_000 }),
			doneRow({ root: '/Elsewhere', path: '/Elsewhere/c', rawBytes: 7_000, undecided: 9 }),
		]
		const card = libraryCard(rows, ROOTS, { counters: [], today: TODAY, firstDay: null }, [])

		expect(card.progress.total).toMatchObject({ folders: 2, doneFolders: 1, donePercent: 50, doneThisMonth: 1 })
		expect(card.undecided).toBe(40)
		expect(card.doneRawBytes).toBe(3_000)
		expect(card.forecast).toBeNull()
	})

	// spec: STATS-001.84
	it('divides the photos undecided by the net rate and names the rest in days, weeks or months', () => {
		expect(forecastOf(40)).toEqual({ kind: 'days', count: 5 })
		expect(forecastOf(41)).toEqual({ kind: 'days', count: 6 })
		expect(forecastOf(104)).toEqual({ kind: 'days', count: 13 })
		expect(forecastOf(112)).toEqual({ kind: 'weeks', count: 2 })
		expect(forecastOf(400)).toEqual({ kind: 'weeks', count: 7 })
		expect(forecastOf(952)).toEqual({ kind: 'weeks', count: 17 })
		expect(forecastOf(960)).toEqual({ kind: 'months', count: 4 })
	})

	// spec: STATS-001.84
	it('counts only the last 90 days up to today', () => {
		const before = '2026-08-28'
		expect(forecastOf(40, [...PACE, decided(before, 9_000)], [...INTAKE, added(before, 9_000)])).toEqual({ kind: 'days', count: 5 })
		expect(forecastOf(40, [...PACE, decided('2026-11-27', 9_000)])).toEqual({ kind: 'days', count: 5 })
	})

	// spec: STATS-001.84
	it('counts from the first counted day when it lies inside the 90 days', () => {
		const firstDay = '2026-11-17'
		expect(forecastOf(30, [decided(firstDay, 100)], [added('2026-11-16', 500)], firstDay)).toEqual({ kind: 'days', count: 3 })
	})

	// spec: STATS-001.84
	it('says the backlog grows when the photos added match or outpace the pictures decided', () => {
		expect(forecastOf(40, PACE, [added(TODAY, 900)])).toEqual({ kind: 'grows' })
		expect(forecastOf(40, PACE, [added(TODAY, 2_000)])).toEqual({ kind: 'grows' })
	})

	// spec: STATS-001.84
	it('says nothing of the rest without a pace', () => {
		expect(forecastOf(40, [decided('2026-08-01', 500)])).toBeNull()
		expect(forecastOf(40, [decided(TODAY, 5), decided('2026-11-25', -5)])).toBeNull()
		expect(forecastOf(40, [], INTAKE)).toBeNull()
		expect(forecastOf(40, PACE, INTAKE, null)).toBeNull()
	})

	// spec: STATS-001.42, STATS-001.84
	it('says nothing of the rest when every photo is decided, at 100 % done', () => {
		const card = libraryCard([doneRow({ path: '/Photos/a' }), doneRow({ path: '/Photos/b' })], ROOTS, { counters: PACE, today: TODAY, firstDay: LONG_AGO }, [])

		expect(card.progress.total.donePercent).toBe(100)
		expect(card.undecided).toBe(0)
		expect(card.forecast).toBeNull()
	})
})
