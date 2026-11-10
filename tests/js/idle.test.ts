// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import { LOUPE_IDLE_MS, useIdle } from '../../src/idle.ts'
import { fakeScheduler } from './fake-scheduler.ts'

/** The overlays' idle state in a mounted host, so unmounting stops the timer. */
function mountIdle(keepAwake = () => false) {
	const scheduler = fakeScheduler()
	let idle!: ReturnType<typeof useIdle>
	const wrapper = mount(defineComponent({
		setup() {
			idle = useIdle(scheduler.schedule, LOUPE_IDLE_MS, keepAwake)
			return () => null
		},
	}))
	return { wrapper, idle, ...scheduler }
}

describe('useIdle', () => {
	it('hides the overlays 2.5 s after the last wake', () => {
		const { idle, timers, fire } = mountIdle()

		expect(idle.idle.value).toBe(false)
		expect(timers.map((timer) => timer.ms)).toEqual([2500])
		fire()

		expect(idle.idle.value).toBe(true)
	})

	it('restarts the timer on a wake and shows the overlays again', () => {
		const { idle, timers, fire } = mountIdle()
		fire()

		idle.wake()

		expect(idle.idle.value).toBe(false)
		expect(timers.filter((timer) => !timer.cancelled)).toHaveLength(1)
	})

	it('keeps the overlays while a control holds the focus', () => {
		const { idle, fire } = mountIdle(() => true)

		fire()

		expect(idle.idle.value).toBe(false)
	})

	it('toggles between hidden at once and shown', () => {
		const { idle, timers } = mountIdle()

		idle.toggle()
		expect(idle.idle.value).toBe(true)
		expect(timers[0]!.cancelled).toBe(true)
		idle.toggle()

		expect(idle.idle.value).toBe(false)
	})

	it('stops the timer on unmount', () => {
		const { wrapper, timers } = mountIdle()

		wrapper.unmount()

		expect(timers[0]!.cancelled).toBe(true)
	})
})
