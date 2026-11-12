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

/** The selection while a drag runs from the pressed tile at `from` to the one at `to`, added to `before`. */
export function dragSelection(before: Selection, order: readonly number[], from: number, to: number): Selection {
	const range = order.slice(Math.min(from, to), Math.max(from, to) + 1)
	return { ids: new Set([...before.ids, ...range]), anchor: order[from]! }
}
