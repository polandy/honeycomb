// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How long a finger stays down on a tile to select it (`docs/plan.md` Tooltip, Gestures). */
export const LONG_PRESS_MS = 480

/** How far the finger may move before the long-press is cancelled, in CSS pixels. */
export const LONG_PRESS_SLOP = 10

/** Runs `run` after `ms`; returns the function that cancels it. */
export type Schedule = (run: () => void, ms: number) => () => void

/** A tile's long-press: started on pointer down, stopped on lifting, cancelling or moving away. */
export function longPress(schedule: Schedule) {
	let cancel: (() => void) | null = null
	let startX = 0
	let startY = 0
	let fired = false

	/** Stops a press that has not fired yet. */
	function stop() {
		cancel?.()
		cancel = null
	}

	return {
		/** Starts a press at the pointer's position; `onPress` runs when it lasts long enough. */
		down(x: number, y: number, onPress: () => void) {
			stop()
			fired = false
			startX = x
			startY = y
			cancel = schedule(() => {
				cancel = null
				fired = true
				onPress()
			}, LONG_PRESS_MS)
		},
		/** Cancels the press once the pointer moved too far. */
		move(x: number, y: number) {
			if (Math.hypot(x - startX, y - startY) > LONG_PRESS_SLOP) {
				stop()
			}
		},
		stop,
		/** Whether the click now arriving ends a long-press and is swallowed; asks only once. */
		takeClick(): boolean {
			const swallow = fired
			fired = false
			return swallow
		},
	}
}
