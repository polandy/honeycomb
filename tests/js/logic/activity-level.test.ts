// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { activityLevel } from '../../../src/logic/activity-level.ts'

describe('activityLevel', () => {
	// spec: STATS-001.71
	it('is 0 without a counter, whatever the busiest day decided', () => {
		expect(activityLevel(0, 90, false)).toBe(0)
		expect(activityLevel(5, 90, false)).toBe(0)
	})

	// spec: STATS-001.71
	it('is 1 up to a third of the busiest day, 2 up to two thirds and 3 above', () => {
		expect(activityLevel(30, 90, true)).toBe(1)
		expect(activityLevel(31, 90, true)).toBe(2)
		expect(activityLevel(60, 90, true)).toBe(2)
		expect(activityLevel(61, 90, true)).toBe(3)
		expect(activityLevel(90, 90, true)).toBe(3)
	})

	// spec: STATS-001.71
	it('is 1 for a counter without a picture decided, also when nothing was decided anywhere', () => {
		expect(activityLevel(0, 90, true)).toBe(1)
		expect(activityLevel(0, 0, true)).toBe(1)
	})
})
