// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { CommonDecision, DecisionIntent } from '../logic/decision-change.ts'
import type { FocusMove } from '../logic/grid-layout.ts'
import type { HotkeyIntent } from '../logic/hotkeys.ts'
import type { ListingEntry, SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'
import type { HotkeyHandlers } from '../shared/hotkeys.ts'
import type { useSelectionMode } from './selection-mode.ts'

import { nextTick } from 'vue'
import { stepRating } from '../logic/hotkeys.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'

type Pictures = readonly Picture<ListingEntry>[]

/** What the grid exposes to its keys. */
export interface GridFocus {
	focusedIndex: () => number
	step: (move: FocusMove) => unknown
	reveal: (index: number) => unknown
	jumpSeries: (direction: 'previous' | 'next') => unknown
}

/** What the keys of every source's grid act on. */
export interface GridCoreTargets<P extends Picture<SourceEntry>> {
	grid: () => GridFocus | null
	view: () => readonly P[]
	selection: ReturnType<typeof useSelectionMode<P>>
	common: (chosen: readonly P[]) => CommonDecision
	decide: (intent: DecisionIntent, chosen: readonly P[]) => void
	openLoupe: (index: number) => void
	toggleFullscreen: () => void
}

/** What the folder grid's keys act on. */
export interface GridHotkeyTargets extends GridCoreTargets<Picture<ListingEntry>> {
	seriesOf: () => ReadonlyMap<Picture<ListingEntry>, Series<Picture<ListingEntry>>>
	pickRest: (picked: Picture<ListingEntry>, rest: Pictures) => void
	/** Tells that the focused photo is in no series (KEYS-001.13). */
	notInSeries: () => void
	toggleFiltersOff: () => void
	openTags: (chosen: Pictures) => boolean
	headerShown: Ref<boolean>
	filtersOpen: Ref<boolean>
	filterBar: () => HTMLElement | undefined
}

/** The selection in selection mode, else the focused photo. */
function chosenAt<P extends Picture<SourceEntry>>({ selection, view }: GridCoreTargets<P>, index: number): readonly P[] {
	return selection.selecting.value ? selection.selected.value : view().slice(index, index + 1)
}

/** The focused tile's index, the first while the grid is not there. */
const focusedOf = ({ grid }: Pick<GridCoreTargets<never>, 'grid'>) => grid()?.focusedIndex() ?? 0

/** The keys every source's grid shares: decide, move, the loupe, selection and fullscreen (KEYS-001.5, KEYS-001.6). */
export function gridCoreHotkeys<P extends Picture<SourceEntry>>(targets: GridCoreTargets<P>): HotkeyHandlers {
	const { grid, view, selection } = targets
	const focusedIndex = () => focusedOf(targets)

	/** Decides the selection in selection mode, else the focused photo; `advance` then moves the focus on unless the photo left the view. */
	function decideByKey(intent: HotkeyIntent, advance: boolean): boolean {
		const index = focusedIndex()
		const chosen = chosenAt(targets, index)
		if (chosen.length === 0) {
			return false
		}
		targets.decide(intent.kind === 'ratingStep' ? { kind: 'rating', rating: stepRating(targets.common(chosen).rating, intent.step) } : intent, chosen)
		if (advance && view()[index] === chosen[0]) {
			grid()?.step('next')
		} else if (advance && view().length > 0) {
			fireAndLog(revealAfterUpdate(index), 'Could not focus the next tile')
		}
		return true
	}

	/** Focuses the tile that took the decided one's place once the grid has dropped it, since a change of its pictures resets the focus. */
	async function revealAfterUpdate(index: number) {
		await nextTick()
		await grid()?.reveal(Math.min(index, view().length - 1))
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
		'select-all': selection.selectAll,
		'select-none': whileSelecting(selection.selectNone),
		close: whileSelecting(() => selection.setSelecting(false)),
		fullscreen: targets.toggleFullscreen,
	}
}

/** The folder grid's keys (`docs/dev/plan.md` Keyboard shortcuts). */
export function gridHotkeys(targets: GridHotkeyTargets): HotkeyHandlers {
	const { grid, view, headerShown, filtersOpen } = targets
	const focusedIndex = () => focusedOf(targets)

	/** Picks the focused photo and rejects the rest of its series, else tells it is in none (KEYS-001.13). */
	function pickRest() {
		const picked = view()[focusedIndex()]
		const series = picked === undefined ? undefined : targets.seriesOf().get(picked)
		if (series === undefined) {
			targets.notInSeries()
			return
		}
		targets.pickRest(picked!, series.members.filter((member) => member !== picked))
	}

	/** Opens the filter bar, with the toolbar, and focuses its first control. */
	async function focusFilters() {
		headerShown.value = true
		filtersOpen.value = true
		await nextTick()
		targets.filterBar()?.querySelector<HTMLElement>('button, input, select')?.focus()
	}

	return {
		...gridCoreHotkeys(targets),
		'previous-series': () => {
			grid()?.jumpSeries('previous')
		},
		'next-series': () => {
			grid()?.jumpSeries('next')
		},
		header: () => {
			headerShown.value = !headerShown.value
		},
		'filter-bar': () => {
			filtersOpen.value = !filtersOpen.value
		},
		'filter-focus': () => {
			fireAndLog(focusFilters(), 'Could not focus the filters')
		},
		'filters-off': targets.toggleFiltersOff,
		tag: () => targets.openTags(chosenAt(targets, focusedIndex())),
		'pick-rest': pickRest,
	}
}
