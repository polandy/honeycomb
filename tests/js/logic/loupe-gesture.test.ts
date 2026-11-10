// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GestureContext, GesturePointer } from '../../../src/logic/loupe-gesture.ts'

import { describe, expect, it } from 'vitest'
import { DOUBLE_TAP_MS, loupeGestures, swipeFlag, TAP_MAX_MS, tapZone } from '../../../src/logic/loupe-gesture.ts'

const WIDTH = 1000

/** A gesture recogniser on a 1000 × 600 px stage, zoomed or not. */
function gestures(context: Partial<GestureContext> = {}) {
	return loupeGestures(() => ({ width: WIDTH, height: 600, zoomed: false, ...context }))
}

/** A touch pointer at x, y at time ms. */
function touch(x: number, y: number, time: number, id = 1): GesturePointer {
	return { id, x, y, time, type: 'touch' }
}

/** A tap at x on the gesture recogniser, at time ms. */
function tap(recogniser: ReturnType<typeof gestures>, x: number, time: number, type: GesturePointer['type'] = 'touch') {
	recogniser.down({ id: 1, x, y: 300, time, type })
	return recogniser.up({ id: 1, x, y: 300, time: time + 50, type })
}

describe('tapZone', () => {
	// spec: LOUPE-001.4
	it('splits the stage into 30 % previous, 40 % middle and 30 % next', () => {
		expect(tapZone(0.29, false, 'touch')).toBe(-1)
		expect(tapZone(0.31, false, 'touch')).toBe(0)
		expect(tapZone(0.69, false, 'pen')).toBe(0)
		expect(tapZone(0.71, false, 'pen')).toBe(1)
	})

	// spec: LOUPE-001.8
	it('is the middle while zoomed and for the mouse', () => {
		expect(tapZone(0.1, true, 'touch')).toBe(0)
		expect(tapZone(0.9, false, 'mouse')).toBe(0)
	})
})

describe('loupeGestures', () => {
	// spec: LOUPE-001.4
	it('pages on a tap in an outer zone at once, twice for two quick taps', () => {
		const recogniser = gestures()

		expect(tap(recogniser, 900, 0)).toEqual({ kind: 'page', step: 1 })
		expect(tap(recogniser, 900, 100)).toEqual({ kind: 'page', step: 1 })
		expect(tap(recogniser, 100, 200)).toEqual({ kind: 'page', step: -1 })
	})

	// spec: LOUPE-001.10
	it('toggles the overlays on a tap in the middle and goes chrome-free on a double-tap', () => {
		const recogniser = gestures()

		expect(tap(recogniser, 500, 0)).toEqual({ kind: 'overlays' })
		expect(tap(recogniser, 510, DOUBLE_TAP_MS - 100)).toEqual({ kind: 'chrome-free' })
		expect(tap(recogniser, 500, 2000)).toEqual({ kind: 'overlays' })
	})

	it('needs the second tap of a double-tap soon and near the first', () => {
		const recogniser = gestures()

		tap(recogniser, 500, 0)
		expect(tap(recogniser, 500, DOUBLE_TAP_MS + 100)).toEqual({ kind: 'overlays' })
		expect(tap(recogniser, 600, DOUBLE_TAP_MS + 200)).toEqual({ kind: 'overlays' })
	})

	// spec: LOUPE-001.4
	it('does not pair a page tap with a middle tap into a double-tap', () => {
		const recogniser = gestures()

		tap(recogniser, 500, 0)
		tap(recogniser, 900, 50)
		expect(tap(recogniser, 500, 100)).toEqual({ kind: 'overlays' })
	})

	// spec: LOUPE-001.8
	it('acts as the middle while zoomed and for a mouse click', () => {
		expect(tap(gestures({ zoomed: true }), 900, 0)).toEqual({ kind: 'overlays' })
		expect(tap(gestures(), 900, 0, 'mouse')).toEqual({ kind: 'overlays' })
	})

	// spec: LOUPE-001.5
	it('ignores a long press and a press the browser cancelled', () => {
		const recogniser = gestures()

		recogniser.down(touch(900, 300, 0))
		expect(recogniser.up(touch(900, 300, TAP_MAX_MS + 1))).toBeNull()
		recogniser.down(touch(900, 300, 1000))
		expect(recogniser.cancel(touch(900, 300, 1010))).toBeNull()
	})

	// spec: LOUPE-001.6
	it('drags the track sideways and pages past 22 % of the width', () => {
		const recogniser = gestures()

		recogniser.down(touch(800, 300, 0))
		expect(recogniser.move(touch(795, 300, 10))).toBeNull()
		expect(recogniser.move(touch(700, 310, 100))).toEqual({ kind: 'drag', dx: -100 })
		recogniser.move(touch(500, 310, 400))
		expect(recogniser.up(touch(500, 310, 400))).toEqual({ kind: 'page', step: 1 })
	})

	// spec: LOUPE-001.6
	it('pages on a quick flick and settles back on a slow short drag', () => {
		const flick = gestures()
		flick.down(touch(300, 300, 0))
		flick.move(touch(320, 300, 10))
		flick.move(touch(400, 300, 50))
		expect(flick.up(touch(400, 300, 50))).toEqual({ kind: 'page', step: -1 })

		const slow = gestures()
		slow.down(touch(300, 300, 0))
		slow.move(touch(350, 300, 500))
		slow.move(touch(400, 300, 1000))
		expect(slow.up(touch(400, 300, 1000))).toEqual({ kind: 'settle' })
	})

	// spec: LOUPE-001.6
	it('settles back when the browser cancels a drag', () => {
		const recogniser = gestures()

		recogniser.down(touch(300, 300, 0))
		recogniser.move(touch(400, 300, 100))
		expect(recogniser.cancel(touch(400, 300, 100))).toEqual({ kind: 'settle' })
	})

	// spec: LOUPE-002.4
	it('lifts the photo on a vertical drag and swipes once it went far enough', () => {
		const down = gestures()
		down.down(touch(500, 300, 0))
		expect(down.move(touch(505, 500, 1000))).toEqual({ kind: 'lift', dy: 200 })
		expect(down.up(touch(505, 500, 1000))).toEqual({ kind: 'swipe', direction: 'down' })

		const up = gestures()
		up.down(touch(500, 400, 0))
		up.move(touch(500, 200, 1000))
		expect(up.up(touch(500, 200, 1000))).toEqual({ kind: 'swipe', direction: 'up' })
	})

	// spec: LOUPE-002.4
	it('swipes on a quick vertical flick however short, and settles back from a slow short one', () => {
		const flick = gestures()
		flick.down(touch(500, 300, 0))
		flick.move(touch(500, 280, 10))
		flick.move(touch(500, 240, 50))
		expect(flick.up(touch(500, 240, 50))).toEqual({ kind: 'swipe', direction: 'up' })

		const slow = gestures()
		slow.down(touch(500, 300, 0))
		slow.move(touch(500, 350, 500))
		slow.move(touch(500, 400, 1000))
		expect(slow.up(touch(500, 400, 1000))).toEqual({ kind: 'settle' })
	})

	// spec: LOUPE-002.4
	it('settles back when the browser cancels a vertical drag', () => {
		const recogniser = gestures()

		recogniser.down(touch(500, 300, 0))
		recogniser.move(touch(500, 450, 100))
		expect(recogniser.cancel(touch(500, 450, 100))).toEqual({ kind: 'settle' })
	})

	// spec: LOUPE-001.8
	it('pans while zoomed instead of paging', () => {
		const recogniser = gestures({ zoomed: true })

		expect(recogniser.down(touch(500, 300, 0))).toEqual({ kind: 'pan-start' })
		expect(recogniser.move(touch(400, 350, 100))).toEqual({ kind: 'pan', dx: -100, dy: 50 })
		expect(recogniser.up(touch(400, 350, 100))).toBeNull()
	})

	it('pinches with two fingers, then ignores the one left until it lifts', () => {
		const recogniser = gestures()

		recogniser.down(touch(400, 300, 0, 1))
		expect(recogniser.down(touch(600, 300, 10, 2))).toEqual({ kind: 'pinch-start', centre: { x: 500, y: 300, distance: 200 } })
		expect(recogniser.move(touch(300, 300, 50, 1))).toEqual({ kind: 'pinch', centre: { x: 450, y: 300, distance: 300 } })
		expect(recogniser.up(touch(300, 300, 60, 1))).toEqual({ kind: 'pinch-end' })
		expect(recogniser.move(touch(900, 300, 70, 2))).toBeNull()
		expect(recogniser.up(touch(900, 300, 80, 2))).toBeNull()
		expect(tap(recogniser, 900, 200)).toEqual({ kind: 'page', step: 1 })
	})

	it('ignores a third finger and pointers it never saw go down', () => {
		const recogniser = gestures()

		recogniser.down(touch(400, 300, 0, 1))
		recogniser.down(touch(600, 300, 0, 2))
		expect(recogniser.down(touch(500, 500, 0, 3))).toBeNull()
		expect(recogniser.move(touch(500, 500, 10, 3))).toBeNull()
		expect(recogniser.move(touch(1, 1, 10, 9))).toBeNull()
		expect(recogniser.up(touch(1, 1, 10, 9))).toBeNull()
	})
})

describe('swipeFlag', () => {
	// spec: LOUPE-002.4
	it('picks on a swipe up and rejects on a swipe down by default (Q6)', () => {
		expect(swipeFlag('up')).toBe('picked')
		expect(swipeFlag('down')).toBe('rejected')
	})

	// spec: LOUPE-002.5
	it('follows the gesture setting, where a direction can do nothing', () => {
		expect(swipeFlag('up', { up: null, down: 'picked' })).toBeNull()
		expect(swipeFlag('down', { up: null, down: 'picked' })).toBe('picked')
	})
})
