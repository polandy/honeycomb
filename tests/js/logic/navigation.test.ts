// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { choiceKey, NAVIGATION_OPEN_MIN_WIDTH, startsOpen, storedChoice } from '../../../src/logic/navigation.ts'

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

describe('choiceKey', () => {
	// spec: APP-001.8
	it('keeps the choice per Nextcloud user, under the base key without one', () => {
		expect(choiceKey('honeycomb.navigationOpen', 'alice')).toBe('honeycomb.navigationOpen.alice')
		expect(choiceKey('honeycomb.navigationOpen', 'bob')).not.toBe(choiceKey('honeycomb.navigationOpen', 'alice'))
		expect(choiceKey('honeycomb.navigationOpen', null)).toBe('honeycomb.navigationOpen')
	})
})

describe('storedChoice', () => {
	// spec: APP-001.8
	it('takes the user\'s own choice before the one an older version kept for the browser', () => {
		expect(storedChoice('false', 'true')).toBe('false')
		expect(storedChoice(null, 'true')).toBe('true')
		expect(storedChoice('broken', 'false')).toBe('false')
		expect(storedChoice(null, null)).toBe(null)
	})
})
