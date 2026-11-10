// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { NOTHING_STORED, parseLocalValue, parseViewState, planViewState } from '../../../src/logic/view-state.ts'

describe('parseViewState', () => {
	// spec: LOUPE-003.5
	it('keeps each boolean and reads anything else as not stored', () => {
		expect(parseViewState({ infoPanelOpen: true, gestureGuideSeen: false })).toEqual({ infoPanelOpen: true, gestureGuideSeen: false })
		expect(parseViewState({ infoPanelOpen: 'true', gestureGuideSeen: null, tileSize: 3 })).toEqual(NOTHING_STORED)
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
			apply: { infoPanelOpen: false, gestureGuideSeen: false },
			upload: {},
			remove: [],
		})
	})

	// spec: LOUPE-003.5, LOUPE-003.7
	it('takes the stored values over the local ones and removes the local leftovers', () => {
		expect(planViewState({ infoPanelOpen: true, gestureGuideSeen: false }, { infoPanelOpen: false, gestureGuideSeen: null }, new Set())).toEqual({
			apply: { infoPanelOpen: true, gestureGuideSeen: false },
			upload: {},
			remove: ['infoPanelOpen'],
		})
	})

	// spec: LOUPE-003.7
	it('takes over a local value the server has never stored and writes it', () => {
		expect(planViewState({ infoPanelOpen: null, gestureGuideSeen: true }, { infoPanelOpen: true, gestureGuideSeen: true }, new Set())).toEqual({
			apply: { infoPanelOpen: true, gestureGuideSeen: true },
			upload: { infoPanelOpen: true },
			remove: ['gestureGuideSeen'],
		})
		expect(planViewState(NOTHING_STORED, { infoPanelOpen: false, gestureGuideSeen: true }, new Set()).upload).toEqual({ infoPanelOpen: false, gestureGuideSeen: true })
	})

	// spec: LOUPE-003.6
	it('leaves a key the user changed before the answer alone', () => {
		expect(planViewState({ infoPanelOpen: false, gestureGuideSeen: null }, { infoPanelOpen: true, gestureGuideSeen: false }, new Set(['infoPanelOpen', 'gestureGuideSeen'] as const))).toEqual({
			apply: {},
			upload: {},
			remove: [],
		})
	})

	// spec: LOUPE-003.8
	it('without an answer takes the local values, else the defaults', () => {
		expect(planViewState(NOTHING_STORED, { infoPanelOpen: true, gestureGuideSeen: null }, new Set()).apply).toEqual({ infoPanelOpen: true, gestureGuideSeen: false })
	})
})
