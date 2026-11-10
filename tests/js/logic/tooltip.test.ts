// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { placeTip, TIP_DELAY_MS, TIP_PRESS_MS, TIP_WARM_MS, tipController } from '../../../src/logic/tooltip.ts'
import { fakeScheduler } from '../fake-scheduler.ts'

const FRAME = { left: 0, top: 0, right: 1000, bottom: 800 }
const SIZE = { width: 100, height: 30 }

/** A 40 × 40 control whose top left corner is at `x`, `y`. */
const control = (x: number, y: number) => ({ left: x, top: y, right: x + 40, bottom: y + 40 })

describe('placeTip', () => {
	// spec: APP-002.6
	it('puts the bubble below a control in the top half, centred, with its arrow at the control', () => {
		expect(placeTip(control(480, 100), SIZE, FRAME, null)).toEqual({ side: 'bottom', x: 450, y: 150, arrow: 50 })
	})

	// spec: APP-002.6
	it('puts the bubble above a control in the bottom half', () => {
		expect(placeTip(control(480, 700), SIZE, FRAME, null)).toEqual({ side: 'top', x: 450, y: 660, arrow: 50 })
	})

	// spec: APP-002.6
	it('keeps the bubble 8 px inside the frame and moves the arrow to stay on the control', () => {
		expect(placeTip(control(0, 100), SIZE, FRAME, null)).toEqual({ side: 'bottom', x: 8, y: 150, arrow: 12 })
	})

	// spec: APP-002.6
	it('goes right, then left, when neither below nor above fits', () => {
		const tall = { width: 100, height: 700 }

		expect(placeTip(control(400, 380), tall, FRAME, null)).toEqual({ side: 'right', x: 450, y: 50, arrow: 350 })
		expect(placeTip(control(900, 380), tall, FRAME, null)).toEqual({ side: 'left', x: 790, y: 50, arrow: 350 })
	})

	// spec: APP-002.6
	it('takes the other side to clear the middle third of the photo', () => {
		const photo = { left: 0, top: 0, right: 1000, bottom: 600 }

		expect(placeTip(control(480, 160), SIZE, FRAME, photo)).toMatchObject({ side: 'top', y: 120 })
	})

	// spec: APP-002.6
	it('falls back to the preferred side, clamped into the frame, when no side fits', () => {
		expect(placeTip(control(480, 100), { width: 2000, height: 900 }, FRAME, null)).toEqual({ side: 'bottom', x: 8, y: 8, arrow: 492 })
	})
})

/** A controller with a fake clock and scheduler, and the anchors it showed. */
function controller() {
	const scheduler = fakeScheduler()
	const clock = { now: 0 }
	const shown: (string | null)[] = []
	const tips = tipController<string>({ schedule: scheduler.schedule, now: () => clock.now }, (anchor) => shown.push(anchor))
	return { ...scheduler, clock, shown, tips }
}

describe('tipController', () => {
	// spec: APP-002.1
	it('shows after 400 ms of hover and hides on leaving', () => {
		const { timers, fire, shown, tips } = controller()

		tips.hover('pick')
		expect(shown).toEqual([])
		fire()
		tips.leave()

		expect(timers.map((timer) => timer.ms)).toEqual([TIP_DELAY_MS])
		expect(shown).toEqual(['pick', null])
		expect(tips.anchor()).toBeNull()
	})

	// spec: APP-002.1
	it('does not show when the pointer leaves before the delay', () => {
		const { fire, shown, tips } = controller()

		tips.hover('pick')
		tips.leave()
		fire()

		expect(shown).toEqual([])
	})

	// spec: APP-002.1
	it('moves on at once to the next control while one shows, and within 300 ms after one hid', () => {
		const { fire, clock, shown, tips } = controller()

		tips.hover('pick')
		fire()
		tips.hover('reject')
		clock.now = 1000
		tips.leave()
		clock.now = 1000 + TIP_WARM_MS - 1
		tips.hover('unflag')
		tips.leave()
		clock.now = 2000 + TIP_WARM_MS
		tips.hover('pick')

		expect(shown).toEqual(['pick', 'reject', null, 'unflag', null])
	})

	// spec: APP-002.1
	it('ignores hover on the control already shown', () => {
		const { timers, fire, shown, tips } = controller()

		tips.hover('pick')
		fire()
		tips.hover('pick')

		expect(timers).toHaveLength(1)
		expect(shown).toEqual(['pick'])
	})

	// spec: APP-002.1
	it('cancels a pending show when the pointer moves to another control', () => {
		const { fire, shown, tips } = controller()

		tips.hover('pick')
		tips.cancelPending()
		fire()

		expect(shown).toEqual([])
	})

	// spec: APP-002.2
	it('shows on focus only when the focus ring shows, and hides on blur of that control', () => {
		const { shown, tips } = controller()

		tips.focus('pick', false)
		tips.focus('reject', true)
		tips.blur('pick')
		tips.blur('reject')

		expect(shown).toEqual(['reject', null])
	})

	// spec: APP-002.3
	it('shows after a 500 ms long-press, hides on release and swallows the click that follows', () => {
		const { timers, fire, shown, tips } = controller()

		tips.pressDown('pick', 10, 10)
		fire()
		tips.pressEnd()

		expect(timers.map((timer) => timer.ms)).toEqual([TIP_PRESS_MS])
		expect(shown).toEqual(['pick', null])
		expect(tips.takeClick()).toBe(true)
		expect(tips.takeClick()).toBe(false)
	})

	// spec: APP-002.3
	it('lets a short tap through and cancels the press once the finger moves more than 10 px', () => {
		const { fire, shown, tips } = controller()

		tips.pressDown('pick', 10, 10)
		tips.pressEnd()
		fire()
		expect(tips.takeClick()).toBe(false)
		tips.pressDown('pick', 10, 10)
		tips.pressMove(21, 10)
		fire()

		expect(shown).toEqual([])
		expect(tips.takeClick()).toBe(false)
	})

	// spec: APP-002.4
	it('hides a shown tooltip on a press outside any control', () => {
		const { fire, shown, tips } = controller()

		tips.hover('pick')
		fire()
		tips.pressDown(null, 0, 0)
		fire()

		expect(shown).toEqual(['pick', null])
	})

	// spec: APP-002.5
	it('hides on Escape and says so, once', () => {
		const { fire, shown, tips } = controller()

		tips.hover('pick')
		fire()

		expect(tips.escape()).toBe(true)
		expect(tips.escape()).toBe(false)
		expect(shown).toEqual(['pick', null])
	})

	// spec: APP-002.4
	it('hides when its control matches, not otherwise', () => {
		const { fire, shown, tips } = controller()

		tips.hover('pick')
		fire()
		tips.hideIf((anchor) => anchor === 'reject')
		tips.hideIf((anchor) => anchor === 'pick')
		tips.hideIf(() => true)

		expect(shown).toEqual(['pick', null])
	})
})
