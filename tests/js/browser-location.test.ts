// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { browserLocation } from '../../src/shared/browser-location.ts'

describe('browserLocation', () => {
	// spec: DECISIONS-002.17
	it('writes the hash in place and removes it for an empty one', () => {
		const entries = window.history.length

		browserLocation.write('#/cull?x=1')
		expect(browserLocation.read()).toBe('#/cull?x=1')

		browserLocation.write('')
		expect(browserLocation.read()).toBe('')
		expect(window.history.length).toBe(entries)
	})
})
