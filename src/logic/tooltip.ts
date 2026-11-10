// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './long-press.ts'

import { longPress } from './long-press.ts'

/** How long the mouse rests on a control before its tooltip shows (`docs/plan.md` Tooltip). */
export const TIP_DELAY_MS = 400

/** How soon after a tooltip hid the next one shows without the delay. */
export const TIP_WARM_MS = 300

/** How long a finger or pen stays down on a control to show its tooltip. */
export const TIP_PRESS_MS = 500

/** The space between the control and the bubble, in CSS pixels. */
const GAP = 10

/** The space the bubble keeps from the frame's edges. */
const MARGIN = 8

/** How close the arrow may come to the bubble's corners, along a horizontal or vertical side. */
const ARROW_INSET = { across: 12, along: 10 }

/** A rectangle in viewport pixels. */
export interface Box {
	readonly left: number
	readonly top: number
	readonly right: number
	readonly bottom: number
}

/** The side of the control the bubble sits on. */
export type TipSide = 'bottom' | 'top' | 'right' | 'left'

/** Where the bubble goes: its top left corner and its arrow's offset along the side. */
export interface TipPlacement {
	readonly side: TipSide
	readonly x: number
	readonly y: number
	readonly arrow: number
}

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), Math.max(low, high))

/** The middle third of the photo, which the bubble does not cover. */
function middleThird(photo: Box): Box {
	const width = (photo.right - photo.left) / 3
	const height = (photo.bottom - photo.top) / 3
	return { left: photo.left + width, top: photo.top + height, right: photo.right - width, bottom: photo.bottom - height }
}

/** Places the bubble at the first side that stays inside the frame and off the photo's middle third, else at the preferred side clamped. */
export function placeTip(anchor: Box, size: { readonly width: number, readonly height: number }, frame: Box, photo: Box | null): TipPlacement {
	const box = { left: frame.left + MARGIN, top: frame.top + MARGIN, right: frame.right - MARGIN, bottom: frame.bottom - MARGIN }
	const { width, height } = size
	const centreX = (anchor.left + anchor.right) / 2
	const centreY = (anchor.top + anchor.bottom) / 2
	const across = (x: number) => clamp(x, box.left, box.right - width)
	const along = (y: number) => clamp(y, box.top, box.bottom - height)
	const at: Record<TipSide, readonly [number, number]> = {
		bottom: [across(centreX - width / 2), anchor.bottom + GAP],
		top: [across(centreX - width / 2), anchor.top - height - GAP],
		right: [anchor.right + GAP, along(centreY - height / 2)],
		left: [anchor.left - width - GAP, along(centreY - height / 2)],
	}
	const middle = photo === null ? null : middleThird(photo)
	const fits = ([x, y]: readonly [number, number]) => x >= box.left && y >= box.top && x + width <= box.right && y + height <= box.bottom
		&& !(middle !== null && x < middle.right && x + width > middle.left && y < middle.bottom && y + height > middle.top)
	const order: TipSide[] = centreY < (box.top + box.bottom) / 2 ? ['bottom', 'top', 'right', 'left'] : ['top', 'bottom', 'right', 'left']
	const side = order.find((candidate) => fits(at[candidate]))
	const [x, y] = side === undefined ? [at[order[0]!][0], along(at[order[0]!][1])] : at[side]
	const placed = side ?? order[0]!
	const arrow = placed === 'top' || placed === 'bottom'
		? clamp(centreX - x, ARROW_INSET.across, width - ARROW_INSET.across)
		: clamp(centreY - y, ARROW_INSET.along, height - ARROW_INSET.along)
	return { side: placed, x, y, arrow }
}

/** The clock and timer of the tooltip. */
export interface TipSeams {
	readonly schedule: Schedule
	/** Milliseconds on a monotonic clock. */
	readonly now: () => number
}

/** When the one tooltip of the app shows and hides; `show` gets the control, or null to hide. */
export function tipController<A>(seams: TipSeams, show: (anchor: A | null) => void) {
	let anchor: A | null = null
	let cancelPending: (() => void) | null = null
	let warmUntil = -Infinity
	const press = longPress(seams.schedule, TIP_PRESS_MS)

	/** Stops a hover that has not shown yet. */
	function stopPending() {
		cancelPending?.()
		cancelPending = null
	}

	/**
	 *
	 */
	function open(next: A) {
		stopPending()
		anchor = next
		show(next)
	}

	/** Hides the tooltip, if one shows. */
	function hide() {
		stopPending()
		if (anchor === null) {
			return
		}
		anchor = null
		warmUntil = seams.now() + TIP_WARM_MS
		show(null)
	}

	return {
		/** The control whose tooltip shows. */
		anchor: () => anchor,
		/** The mouse entered a control. */
		hover(next: A) {
			if (next === anchor) {
				return
			}
			stopPending()
			if (anchor !== null || seams.now() < warmUntil) {
				open(next)
			} else {
				cancelPending = seams.schedule(() => {
					cancelPending = null
					open(next)
				}, TIP_DELAY_MS)
			}
		},
		/** The mouse left for a place without a tooltip. */
		leave: hide,
		/** The mouse left for another control, which takes over. */
		cancelPending: stopPending,
		/** A control got focus; its tooltip shows when the focus ring does. */
		focus(next: A, ringShown: boolean) {
			if (ringShown) {
				open(next)
			} else {
				hide()
			}
		},
		/** A control lost focus. */
		blur(previous: A) {
			if (previous === anchor) {
				hide()
			}
		},
		/** A finger or pen went down, on a control or on nothing (null). */
		pressDown(next: A | null, x: number, y: number) {
			press.stop()
			press.takeClick()
			hide()
			if (next !== null) {
				press.down(x, y, () => open(next))
			}
		},
		/** The finger moved; too far cancels the press. */
		pressMove: press.move,
		/** The finger lifted or the browser took the pointer. */
		pressEnd() {
			press.stop()
			hide()
		},
		/** Whether the click now arriving ends a long-press and is swallowed. */
		takeClick: press.takeClick,
		/** Escape hides a shown tooltip; returns whether it did, so the key goes no further. */
		escape(): boolean {
			const shown = anchor !== null
			hide()
			return shown
		},
		/** Hides the tooltip when its control matches. */
		hideIf(matches: (shown: A) => boolean) {
			if (anchor !== null && matches(anchor)) {
				hide()
			}
		},
		hide,
	}
}
