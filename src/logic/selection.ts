// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The selected pictures by their grid key and the anchor a Shift-click ranges from. */
export interface Selection {
	readonly ids: ReadonlySet<number>
	readonly anchor: number | null
}

/** A click's modifiers: `toggle` is Ctrl, or Cmd on a Mac. */
export interface TileClick {
	readonly shift: boolean
	readonly toggle: boolean
}

/** The keys of a keyboard event that selection mode reads. */
export interface SelectionKeyEvent {
	readonly key: string
	readonly ctrlKey: boolean
	readonly metaKey: boolean
	readonly shiftKey: boolean
	readonly altKey: boolean
}

/** What a key does to the selection. */
export type SelectionKeyAction = 'select-all' | 'select-none' | 'leave'

/** Nothing selected. */
export const NO_SELECTION: Selection = { ids: new Set(), anchor: null }

/** The selection after a tile click, or null when the click is not a selection click. */
export function selectionAfterClick(selecting: boolean, selection: Selection, order: readonly number[], id: number, click: TileClick): Selection | null {
	if (!selecting && !click.shift && !click.toggle) {
		return null
	}
	const from = selection.anchor === null ? -1 : order.indexOf(selection.anchor)
	const to = order.indexOf(id)
	if (click.shift && from >= 0 && to >= 0) {
		const range = order.slice(Math.min(from, to), Math.max(from, to) + 1)
		return { ids: new Set([...selection.ids, ...range]), anchor: selection.anchor }
	}
	const ids = new Set(selection.ids)
	if (!ids.delete(id)) {
		ids.add(id)
	}
	return { ids, anchor: id }
}

/** The selection with the tile added, as a long-press adds it. */
export function addSelected(selection: Selection, id: number): Selection {
	return selection.ids.has(id) && selection.anchor === id ? selection : { ids: new Set([...selection.ids, id]), anchor: id }
}

/** Every shown picture selected. */
export function selectAll(selection: Selection, order: readonly number[]): Selection {
	return { ids: new Set(order), anchor: selection.anchor }
}

/** The selection without the pictures the view no longer shows; the same object when none left. */
export function keepShown(selection: Selection, order: readonly number[]): Selection {
	const shown = new Set(order)
	const ids = [...selection.ids].filter((id) => shown.has(id))
	if (ids.length === selection.ids.size) {
		return selection
	}
	const anchor = selection.anchor !== null && shown.has(selection.anchor) ? selection.anchor : null
	return { ids: new Set(ids), anchor }
}

/** The selection action of a key (`docs/plan.md` Keyboard shortcuts), or null. */
export function selectionKey(event: SelectionKeyEvent): SelectionKeyAction | null {
	const command = (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey
	const key = event.key.toLowerCase()
	if (command && key === 'a') {
		return 'select-all'
	}
	if (command && key === 'd') {
		return 'select-none'
	}
	const bare = !event.ctrlKey && !event.metaKey && !event.altKey
	return bare && event.key === 'Escape' ? 'leave' : null
}
