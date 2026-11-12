// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Frame } from './auto-scroll.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Selection } from './logic/selection.ts'

import { computed, onBeforeUnmount, shallowRef } from 'vue'
import { autoScroll } from './auto-scroll.ts'
import { longPress } from './logic/long-press.ts'
import { addSelected, dragSelection, selectionAfterClick } from './logic/selection.ts'

/** The grid's selection state and where its changes go. */
export interface TileSelectionState {
	readonly selecting: () => boolean
	readonly selection: () => Selection
	/** The grid keys in the grid's order. */
	readonly order: () => readonly number[]
	readonly select: (selection: Selection) => void
	readonly enterSelecting: () => void
	/** Opens the picture in the loupe. */
	readonly open: (id: number) => void
	/** The index in `order` of the tile under a viewport point, or null where there is none. */
	readonly indexAt: (x: number, y: number) => number | null
	/** The auto-scroll step of one frame for a finger at viewport height `y`. */
	readonly stepAt: (y: number) => number
	/** Scrolls the grid; false when it could not move. */
	readonly scrollBy: (step: number) => boolean
}

/** A drag after a long-press: the selection before it and the range's ends as indexes in the order. */
interface Drag {
	readonly before: Selection
	readonly from: number
	to: number
}

/** Runs `run` after `ms` on the browser's timer. */
export const browserSchedule: Schedule = (run, ms) => {
	const timer = window.setTimeout(run, ms)
	return () => window.clearTimeout(timer)
}

/** A tile's clicks, keys, long-press and drag as selection changes or opening (`docs/plan.md` Selection mode). */
export function useTileSelection(state: TileSelectionState, schedule: Schedule, frame: Frame) {
	const press = longPress(schedule)
	const drag = shallowRef<Drag | null>(null)
	let point = { x: 0, y: 0 }
	const scroll = autoScroll(frame, state.scrollBy, extend)

	/** Ends the press and the drag. */
	function end() {
		press.stop()
		scroll.stop()
		drag.value = null
	}
	onBeforeUnmount(end)

	/** Runs the drag's range to the tile under the finger. */
	function extend() {
		const current = drag.value!
		const to = state.indexAt(point.x, point.y)
		if (to !== null && to !== current.to) {
			current.to = to
			state.select(dragSelection(current.before, state.order(), current.from, to))
		}
	}

	/** Applies a click or key on the tile; true when it changed the selection. */
	function toggle(id: number, shift: boolean, toggleKey: boolean): boolean {
		const next = selectionAfterClick(state.selecting(), state.selection(), state.order(), id, { shift, toggle: toggleKey })
		if (next === null) {
			return false
		}
		if (!state.selecting()) {
			state.enterSelecting()
		}
		state.select(next)
		return true
	}

	return {
		onClick(id: number, event: MouseEvent) {
			if (!press.takeClick() && !toggle(id, event.shiftKey, event.ctrlKey || event.metaKey)) {
				state.open(id)
			}
		},
		onKeydown(id: number, event: KeyboardEvent) {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault()
				if (!toggle(id, event.shiftKey, event.ctrlKey || event.metaKey)) {
					state.open(id)
				}
			}
		},
		onPointerDown(id: number, event: PointerEvent) {
			if (event.button !== 0) {
				return
			}
			press.down(event.clientX, event.clientY, () => {
				const before = state.selection()
				const from = state.order().indexOf(id)
				if (!state.selecting()) {
					state.enterSelecting()
				}
				state.select(addSelected(before, id))
				drag.value = { before, from, to: from }
			})
		},
		onPointerMove(event: PointerEvent) {
			point = { x: event.clientX, y: event.clientY }
			if (drag.value === null) {
				press.move(event.clientX, event.clientY)
				return
			}
			extend()
			scroll.follow(state.stepAt(event.clientY))
		},
		onPointerEnd: end,
		/** The index of the tile a running drag started on, or null without a drag. */
		dragOrigin: computed(() => drag.value?.from ?? null),
	}
}
