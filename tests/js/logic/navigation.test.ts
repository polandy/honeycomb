// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { NAVIGATION_OPEN_MIN_WIDTH, startsOpen } from '../../../src/logic/navigation.ts'

describe('startsOpen', () => {
	// spec: APP-001.7
	it('opens the navigation from 1280 px on while the user has made no choice', () => {
		expect(NAVIGATION_OPEN_MIN_WIDTH).toBe(1280)
		expect(startsOpen(null, 1280)).toBe(true)
		expect(startsOpen(null, 1279)).toBe(false)
		expect(startsOpen('unknown', 1024)).toBe(false)
	})

	// spec: APP-001.8
	it('follows the choice the user made at any width', () => {
		expect(startsOpen('true', 1024)).toBe(true)
		expect(startsOpen('false', 1920)).toBe(false)
	})
})
