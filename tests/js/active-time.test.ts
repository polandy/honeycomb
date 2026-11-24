// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { effectScope } from 'vue'
import { useActiveTime } from '../../src/statistics/active-time.ts'

describe('useActiveTime', () => {
	// spec: STATS-001.39
	it('measures the time between inputs and hands it out once, in whole seconds', () => {
		let now = 0
		const scope = effectScope()
		const active = scope.run(() => useActiveTime(() => now))!

		window.dispatchEvent(new PointerEvent('pointerdown'))
		now = 60_000
		window.dispatchEvent(new KeyboardEvent('keydown'))
		now = 90_500
		window.dispatchEvent(new WheelEvent('wheel'))

		expect(active.take()).toBe(90)
		expect(active.take()).toBe(0)
		scope.stop()
		now = 120_000
		window.dispatchEvent(new PointerEvent('pointerdown'))
		expect(active.take()).toBe(0)
	})
})
