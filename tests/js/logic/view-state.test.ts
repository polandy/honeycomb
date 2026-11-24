// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { NOTHING_STORED, parseLocalValue, parseViewState, planViewState } from '../../../src/logic/view-state.ts'

describe('parseViewState', () => {
	// spec: LOUPE-003.5
	it('keeps each boolean and reads anything else as not stored', () => {
		expect(parseViewState({ info_panel_open: true, gesture_guide_seen: false, series_hint_seen: true, reject_hint_seen: true })).toEqual({ info_panel_open: true, gesture_guide_seen: false, series_hint_seen: true, reject_hint_seen: true })
		expect(parseViewState({ info_panel_open: true, gesture_guide_seen: false })).toEqual({ info_panel_open: true, gesture_guide_seen: false, series_hint_seen: null, reject_hint_seen: null })
		expect(parseViewState({ info_panel_open: 'true', gesture_guide_seen: null, series_hint_seen: 1, reject_hint_seen: null, tileSize: 3 })).toEqual(NOTHING_STORED)
		expect(parseViewState({})).toEqual(NOTHING_STORED)
		expect(parseViewState(null)).toEqual(NOTHING_STORED)
		expect(parseViewState([true, true])).toEqual(NOTHING_STORED)
	})
})

describe('parseLocalValue', () => {
	// spec: LOUPE-003.7
	it('reads only true and false from browser storage', () => {
		expect([parseLocalValue('true'), parseLocalValue('false')]).toEqual([true, false])
		expect([parseLocalValue(null), parseLocalValue(''), parseLocalValue('yes')]).toEqual([null, null, null])
	})
})

describe('planViewState', () => {
	// spec: LOUPE-003.5
	it('takes the defaults when neither the server nor the browser has a value, and writes nothing', () => {
		expect(planViewState(NOTHING_STORED, NOTHING_STORED, new Set())).toEqual({
			apply: { info_panel_open: false, gesture_guide_seen: false, series_hint_seen: false, reject_hint_seen: false },
			upload: {},
			remove: [],
		})
	})

	// spec: LOUPE-003.5, LOUPE-003.7
	it('takes the stored values over the local ones and removes the local leftovers', () => {
		expect(planViewState({ info_panel_open: true, gesture_guide_seen: false, series_hint_seen: true, reject_hint_seen: true }, { info_panel_open: false, gesture_guide_seen: null, series_hint_seen: null, reject_hint_seen: null }, new Set())).toEqual({
			apply: { info_panel_open: true, gesture_guide_seen: false, series_hint_seen: true, reject_hint_seen: true },
			upload: {},
			remove: ['info_panel_open'],
		})
	})

	// spec: LOUPE-003.7
	it('takes over a local value the server has never stored and writes it', () => {
		expect(planViewState({ info_panel_open: null, gesture_guide_seen: true, series_hint_seen: null, reject_hint_seen: null }, { info_panel_open: true, gesture_guide_seen: true, series_hint_seen: null, reject_hint_seen: null }, new Set())).toEqual({
			apply: { info_panel_open: true, gesture_guide_seen: true, series_hint_seen: false, reject_hint_seen: false },
			upload: { info_panel_open: true },
			remove: ['gesture_guide_seen'],
		})
		expect(planViewState(NOTHING_STORED, { info_panel_open: false, gesture_guide_seen: true, series_hint_seen: null, reject_hint_seen: null }, new Set()).upload).toEqual({ info_panel_open: false, gesture_guide_seen: true })
	})

	// spec: LOUPE-003.6
	it('leaves a key the user changed before the answer alone', () => {
		expect(planViewState({ info_panel_open: false, gesture_guide_seen: null, series_hint_seen: true, reject_hint_seen: true }, { info_panel_open: true, gesture_guide_seen: false, series_hint_seen: null, reject_hint_seen: null }, new Set(['info_panel_open', 'gesture_guide_seen', 'series_hint_seen'] as const))).toEqual({
			apply: {},
			upload: {},
			remove: [],
		})
	})

	// spec: LOUPE-003.8
	it('without an answer takes the local values, else the defaults', () => {
		expect(planViewState(NOTHING_STORED, { info_panel_open: true, gesture_guide_seen: null, series_hint_seen: null, reject_hint_seen: null }, new Set()).apply).toEqual({ info_panel_open: true, gesture_guide_seen: false, series_hint_seen: false, reject_hint_seen: false })
	})
})
