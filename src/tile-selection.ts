// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './logic/long-press.ts'
import type { Selection } from './logic/selection.ts'

import { onBeforeUnmount } from 'vue'
import { longPress } from './logic/long-press.ts'
import { addSelected, selectionAfterClick } from './logic/selection.ts'

/** The grid's selection state and where its changes go. */
export interface TileSelectionState {
	readonly selecting: () => boolean
	readonly selection: () => Selection
	/** The grid keys in the grid's order. */
	readonly order: () => readonly number[]
	readonly select: (selection: Selection) => void
	readonly enterSelecting: () => void
}

/** Runs `run` after `ms` on the browser's timer. */
export const browserSchedule: Schedule = (run, ms) => {
	const timer = window.setTimeout(run, ms)
	return () => window.clearTimeout(timer)
}

/** A tile's clicks, keys and long-press as selection changes (`docs/plan.md` Selection mode). */
export function useTileSelection(state: TileSelectionState, schedule: Schedule) {
	const press = longPress(schedule)
	onBeforeUnmount(press.stop)

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
			if (!press.takeClick()) {
				toggle(id, event.shiftKey, event.ctrlKey || event.metaKey)
			}
		},
		onKeydown(id: number, event: KeyboardEvent) {
			if ((event.key === 'Enter' || event.key === ' ') && toggle(id, event.shiftKey, event.ctrlKey || event.metaKey)) {
				event.preventDefault()
			}
		},
		onPointerDown(id: number, event: PointerEvent) {
			if (event.button !== 0) {
				return
			}
			press.down(event.clientX, event.clientY, () => {
				if (!state.selecting()) {
					state.enterSelecting()
				}
				state.select(addSelected(state.selection(), id))
			})
		},
		onPointerMove(event: PointerEvent) {
			press.move(event.clientX, event.clientY)
		},
		onPointerEnd: press.stop,
	}
}
