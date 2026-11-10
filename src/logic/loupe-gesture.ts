// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './decision.ts'
import type { PinchCentre } from './loupe-zoom.ts'

/** Each outer tap zone's share of the stage width (`docs/plan.md` Tap zones). */
const TAP_ZONE = 0.3

/** The longest touch that is a tap, the tooltip's long-press time. */
export const TAP_MAX_MS = 500

/** The movement in CSS pixels below which a touch is still a tap. */
const TAP_SLOP = 8

/** The longest pause between the two taps of a double-tap. */
export const DOUBLE_TAP_MS = 320

/** How far apart the two taps of a double-tap may land, in CSS pixels. */
const DOUBLE_TAP_SLOP = 40

/** The share of the stage width a drag must travel to page, and of its height to swipe. */
const PAGE_DISTANCE = 0.22

/** The speed in CSS pixels per millisecond at which a flick pages or swipes however short it is. */
const PAGE_SPEED = 0.5

/** How many recent pointer positions measure a flick's speed. */
const SPEED_SAMPLES = 6

/** A pointer event as the gestures take it: position relative to the stage, time in ms. */
export interface GesturePointer {
	readonly id: number
	readonly x: number
	readonly y: number
	readonly time: number
	readonly type: 'mouse' | 'pen' | 'touch'
}

/** What the gestures need to know about the stage when a pointer goes down. */
export interface GestureContext {
	readonly width: number
	readonly height: number
	readonly zoomed: boolean
}

/** A vertical swipe's direction. */
export type SwipeDirection = 'up' | 'down'

/** The flag each swipe direction sets, or null where it does nothing. */
export type SwipeSetting = Readonly<Record<SwipeDirection, Flag | null>>

/** Swipe up picks, swipe down rejects (`docs/plan.md` Q6). */
export const DEFAULT_SWIPES: SwipeSetting = { up: 'picked', down: 'rejected' }

/** What a gesture asks the loupe to do. */
export type GestureAction
	= | { readonly kind: 'page', readonly step: -1 | 1 }
		| { readonly kind: 'overlays' }
		| { readonly kind: 'chrome-free' }
		| { readonly kind: 'drag', readonly dx: number }
		| { readonly kind: 'settle' }
		| { readonly kind: 'lift', readonly dy: number }
		| { readonly kind: 'swipe', readonly direction: SwipeDirection }
		| { readonly kind: 'pan-start' }
		| { readonly kind: 'pan', readonly dx: number, readonly dy: number }
		| { readonly kind: 'pinch-start', readonly centre: PinchCentre }
		| { readonly kind: 'pinch', readonly centre: PinchCentre }
		| { readonly kind: 'pinch-end' }

/** The zone a tap at `fraction` of the stage width falls in: previous, middle or next. */
export function tapZone(fraction: number, zoomed: boolean, type: GesturePointer['type']): -1 | 0 | 1 {
	if (zoomed || type === 'mouse') {
		return 0
	}
	return fraction < TAP_ZONE ? -1 : fraction > 1 - TAP_ZONE ? 1 : 0
}

type Mode = 'undecided' | 'drag' | 'vertical' | 'pan' | 'pinch' | 'done'

/** The flag a swipe in `direction` sets under `setting`. */
export function swipeFlag(direction: SwipeDirection, setting: SwipeSetting = DEFAULT_SWIPES): Flag | null {
	return setting[direction]
}

/** Recognises taps, swipes, pans and pinches on the loupe's stage from its pointer events. */
export function loupeGestures(context: () => GestureContext) {
	const pointers = new Map<number, GesturePointer>()
	let mode: Mode = 'undecided'
	let start: GesturePointer | null = null
	let zoomed = false
	let samples: GesturePointer[] = []
	let lastTap: GesturePointer | null = null

	/** The centre and distance of the first two fingers. */
	function centre(): PinchCentre {
		const [a, b] = [...pointers.values()] as [GesturePointer, GesturePointer]
		return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) }
	}

	/** The action of a tap that ended at `end`. */
	function tapAction(end: GesturePointer): GestureAction | null {
		const { width } = context()
		const zone = tapZone(end.x / width, zoomed, end.type)
		if (zone !== 0) {
			lastTap = null
			return { kind: 'page', step: zone }
		}
		const double = lastTap !== null && end.time - lastTap.time < DOUBLE_TAP_MS
			&& Math.hypot(end.x - lastTap.x, end.y - lastTap.y) < DOUBLE_TAP_SLOP
		lastTap = double ? null : end
		return { kind: double ? 'chrome-free' : 'overlays' }
	}

	/** The signed travel along `axis` of a drag that went far or fast enough, else null. */
	function flung(end: GesturePointer, axis: 'x' | 'y'): number | null {
		const first = samples[0]!
		const last = samples.at(-1)!
		const speed = (last[axis] - first[axis]) / Math.max(1, last.time - first.time)
		const travel = end[axis] - start![axis]
		const far = Math.abs(travel) > (axis === 'x' ? context().width : context().height) * PAGE_DISTANCE
		return far ? travel : Math.abs(speed) > PAGE_SPEED ? speed : null
	}

	/** Pages after a sideways drag, or swipes after a vertical one, that went far or fast enough, else settles back. */
	function dragEnd(end: GesturePointer, ended: 'drag' | 'vertical'): GestureAction {
		const travel = flung(end, ended === 'drag' ? 'x' : 'y')
		if (travel === null) {
			return { kind: 'settle' }
		}
		return ended === 'drag' ? { kind: 'page', step: travel < 0 ? 1 : -1 } : { kind: 'swipe', direction: travel < 0 ? 'up' : 'down' }
	}

	return {
		down(pointer: GesturePointer): GestureAction | null {
			if (pointers.size >= 2) {
				return null
			}
			pointers.set(pointer.id, pointer)
			if (pointers.size === 2) {
				mode = 'pinch'
				return { kind: 'pinch-start', centre: centre() }
			}
			mode = 'undecided'
			start = pointer
			samples = [pointer]
			zoomed = context().zoomed
			return zoomed ? { kind: 'pan-start' } : null
		},
		move(pointer: GesturePointer): GestureAction | null {
			if (!pointers.has(pointer.id)) {
				return null
			}
			pointers.set(pointer.id, pointer)
			if (mode === 'pinch') {
				return { kind: 'pinch', centre: centre() }
			}
			const dx = pointer.x - start!.x
			const dy = pointer.y - start!.y
			if (mode === 'undecided') {
				if (Math.hypot(dx, dy) < TAP_SLOP) {
					return null
				}
				mode = zoomed ? 'pan' : Math.abs(dx) > Math.abs(dy) ? 'drag' : 'vertical'
			}
			samples = [...samples, pointer].slice(-SPEED_SAMPLES)
			if (mode === 'pan') {
				return { kind: 'pan', dx, dy }
			}
			return mode === 'drag' ? { kind: 'drag', dx } : mode === 'vertical' ? { kind: 'lift', dy } : null
		},
		up(pointer: GesturePointer): GestureAction | null {
			if (!pointers.delete(pointer.id)) {
				return null
			}
			if (mode === 'pinch') {
				mode = 'done'
				return { kind: 'pinch-end' }
			}
			if (pointers.size > 0) {
				return null
			}
			const ended = mode
			mode = 'undecided'
			if (ended === 'drag' || ended === 'vertical') {
				return dragEnd(pointer, ended)
			}
			return ended === 'undecided' && pointer.time - start!.time <= TAP_MAX_MS ? tapAction(pointer) : null
		},
		cancel(pointer: GesturePointer): GestureAction | null {
			if (!pointers.delete(pointer.id)) {
				return null
			}
			const ended = mode
			mode = pointers.size > 0 ? 'done' : 'undecided'
			if (ended === 'pinch') {
				return { kind: 'pinch-end' }
			}
			return ended === 'drag' || ended === 'vertical' ? { kind: 'settle' } : null
		},
	}
}
