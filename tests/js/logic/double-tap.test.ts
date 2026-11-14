// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_MS, doubleTaps } from '../../../src/logic/double-tap.ts'

describe('doubleTaps', () => {
	// spec: SERIES-001.23
	it('recognises the second of two quick taps close together on one target', () => {
		const taps = doubleTaps()

		expect(taps.tap({ time: 1000, x: 100, y: 100, target: 2 })).toBe(false)
		expect(taps.tap({ time: 1000 + DOUBLE_TAP_MS - 1, x: 110, y: 95, target: 2 })).toBe(true)
	})

	// spec: SERIES-001.23
	it('starts over after a double tap, so a third tap is a single one', () => {
		const taps = doubleTaps()
		taps.tap({ time: 0, x: 0, y: 0 })
		taps.tap({ time: 100, x: 0, y: 0 })

		expect(taps.tap({ time: 200, x: 0, y: 0 })).toBe(false)
	})

	// spec: SERIES-001.23
	it('takes a slow, a distant or another target\'s second tap as a new first tap', () => {
		const taps = doubleTaps()

		expect(taps.tap({ time: 0, x: 0, y: 0, target: 1 })).toBe(false)
		expect(taps.tap({ time: DOUBLE_TAP_MS, x: 0, y: 0, target: 1 })).toBe(false)
		expect(taps.tap({ time: DOUBLE_TAP_MS + 10, x: 40, y: 0, target: 1 })).toBe(false)
		expect(taps.tap({ time: DOUBLE_TAP_MS + 20, x: 40, y: 0, target: 2 })).toBe(false)
		expect(taps.tap({ time: DOUBLE_TAP_MS + 30, x: 40, y: 0, target: 2 })).toBe(true)
	})

	it('forgets the last tap on reset', () => {
		const taps = doubleTaps()
		taps.tap({ time: 0, x: 0, y: 0 })
		taps.reset()

		expect(taps.tap({ time: 10, x: 0, y: 0 })).toBe(false)
	})
})
