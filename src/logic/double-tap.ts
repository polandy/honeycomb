// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The longest pause between the two taps of a double-tap. */
export const DOUBLE_TAP_MS = 320

/** How far apart the two taps of a double-tap may land, in CSS pixels. */
const DOUBLE_TAP_SLOP = 40

/** A tap: its time in ms from an injected clock, its position, and what it landed on. */
export interface Tap {
	readonly time: number
	readonly x: number
	readonly y: number
	readonly target?: unknown
}

/** Recognises the second of two quick taps close together on one target; a double-tap starts over. */
export function doubleTaps() {
	let last: Tap | null = null

	return {
		/** Takes a tap; true when it completes a double-tap. */
		tap(tap: Tap): boolean {
			const double = last !== null && tap.time - last.time < DOUBLE_TAP_MS && tap.target === last.target
				&& Math.hypot(tap.x - last.x, tap.y - last.y) < DOUBLE_TAP_SLOP
			last = double ? null : tap
			return double
		},
		/** Forgets the last tap, so the next one is a first tap. */
		reset() {
			last = null
		},
	}
}
