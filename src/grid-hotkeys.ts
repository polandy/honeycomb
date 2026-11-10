// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { HotkeyHandlers } from './hotkeys.ts'
import type { CommonDecision, DecisionIntent } from './logic/decision-change.ts'
import type { FocusMove } from './logic/grid-layout.ts'
import type { HotkeyIntent } from './logic/hotkeys.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { useSelectionMode } from './selection-mode.ts'

import { nextTick } from 'vue'
import { stepRating } from './logic/hotkeys.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** What the grid exposes to its keys. */
export interface GridFocus {
	focusedIndex: () => number
	step: (move: FocusMove) => unknown
	reveal: (index: number) => unknown
}

/** What the grid's keys act on. */
export interface GridHotkeyTargets {
	grid: () => GridFocus | null
	view: () => Pictures
	selection: ReturnType<typeof useSelectionMode>
	common: (chosen: Pictures) => CommonDecision
	decide: (intent: DecisionIntent, chosen: Pictures) => void
	toggleFiltersOff: () => void
	openLoupe: (index: number) => void
	headerShown: Ref<boolean>
	filtersOpen: Ref<boolean>
	filterBar: () => HTMLElement | undefined
	toggleFullscreen: () => void
}

/** The grid's keys (`docs/plan.md` Keyboard shortcuts). */
export function gridHotkeys(targets: GridHotkeyTargets): HotkeyHandlers {
	const { grid, view, selection, headerShown, filtersOpen } = targets
	const focusedIndex = () => grid()?.focusedIndex() ?? 0

	/** Decides the selection in selection mode, else the focused photo; `advance` then moves the focus on unless the photo left the view. */
	function decideByKey(intent: HotkeyIntent, advance: boolean): boolean {
		const index = focusedIndex()
		const chosen = selection.selecting.value ? selection.selected.value : view().slice(index, index + 1)
		if (chosen.length === 0) {
			return false
		}
		targets.decide(intent.kind === 'ratingStep' ? { kind: 'rating', rating: stepRating(targets.common(chosen).rating, intent.step) } : intent, chosen)
		if (advance && view()[index] === chosen[0]) {
			grid()?.step('next')
		} else if (advance && view().length > 0) {
			grid()?.reveal(Math.min(index, view().length - 1))
		}
		return true
	}

	/** Opens the filter bar, with the toolbar, and focuses its first control. */
	async function focusFilters() {
		headerShown.value = true
		filtersOpen.value = true
		await nextTick()
		targets.filterBar()?.querySelector<HTMLElement>('button, input, select')?.focus()
	}

	/** A key that moves the focus. */
	function step(move: FocusMove) {
		return () => {
			grid()?.step(move)
		}
	}

	/** A key that acts only while selecting; otherwise it stays unhandled. */
	function whileSelecting(act: () => void) {
		return () => {
			if (!selection.selecting.value) {
				return false
			}
			act()
			return true
		}
	}

	return {
		decide: decideByKey,
		previous: step('previous'),
		next: step('next'),
		up: step('up'),
		down: step('down'),
		first: step('first'),
		last: step('last'),
		loupe: () => {
			if (view().length === 0) {
				return false
			}
			targets.openLoupe(focusedIndex())
			return true
		},
		header: () => {
			headerShown.value = !headerShown.value
		},
		'filter-bar': () => {
			filtersOpen.value = !filtersOpen.value
		},
		'filter-focus': () => {
			void focusFilters()
		},
		'filters-off': targets.toggleFiltersOff,
		'select-all': selection.selectAll,
		'select-none': whileSelecting(selection.selectNone),
		close: whileSelecting(() => selection.setSelecting(false)),
		fullscreen: targets.toggleFullscreen,
	}
}
