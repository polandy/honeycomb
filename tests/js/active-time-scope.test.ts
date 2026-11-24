// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { useActiveTime } from '../../src/active-time.ts'

describe('useActiveTime outside a scope', () => {
	// spec: STATS-001.39
	it('measures the inputs and has no scope to stop it', () => {
		let now = 0
		const active = useActiveTime(() => now)

		window.dispatchEvent(new PointerEvent('pointerdown'))
		now = 5_000
		window.dispatchEvent(new KeyboardEvent('keydown'))

		expect(active.take()).toBe(5)
	})
})
