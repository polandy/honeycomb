// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** What the grid lays out, in CSS pixels; `groups` holds each group's picture count. */
export interface GridLayoutInput {
	readonly width: number
	readonly tileSize: number
	readonly gap: number
	readonly headerHeight: number
	readonly groups: readonly number[]
	readonly showHeaders: boolean
}

/** A group's header or one row of its square tiles; `first` counts pictures across groups. */
export type GridRow
	= | { readonly kind: 'header', readonly group: number, readonly top: number, readonly height: number }
		| { readonly kind: 'tiles', readonly group: number, readonly first: number, readonly count: number, readonly top: number, readonly height: number }

/** The rows of a virtual-scrolling grid, ordered by `top`. */
export interface GridLayout {
	readonly rows: readonly GridRow[]
	readonly totalHeight: number
	readonly columns: number
	readonly tileWidth: number
	readonly showHeaders: boolean
}

/** Lays out the groups in as many columns of stretched square tiles as fit the width. */
export function gridLayout(input: GridLayoutInput): GridLayout {
	const { width, tileSize, gap, headerHeight, groups, showHeaders } = input
	const columns = Math.max(1, Math.floor((width + gap) / (tileSize + gap)))
	const tileWidth = Math.max(0, (width - gap * (columns - 1)) / columns)
	const rows: GridRow[] = []
	let top = 0
	const add = (row: GridRow) => {
		rows.push(row)
		top = row.top + row.height + gap
	}
	let first = 0
	groups.forEach((count, group) => {
		if (count > 0 && showHeaders) {
			add({ kind: 'header', group, top, height: headerHeight })
		}
		for (let offset = 0; offset < count; offset += columns) {
			add({ kind: 'tiles', group, first: first + offset, count: Math.min(columns, count - offset), top, height: tileWidth })
		}
		first += count
	})
	const last = rows.at(-1)
	return { rows, totalHeight: last === undefined ? 0 : last.top + last.height, columns, tileWidth, showHeaders }
}

/** The rows from `start` to before `end` that cross the viewport, plus `overscan` rows on each side. */
export function visibleRows(layout: GridLayout, scrollTop: number, viewportHeight: number, overscan: number): { start: number, end: number } {
	const { rows } = layout
	const start = firstRowWhere(rows, (row) => row.top + row.height > scrollTop)
	const end = firstRowWhere(rows, (row) => row.top >= scrollTop + viewportHeight)
	return start < end
		? { start: Math.max(0, start - overscan), end: Math.min(rows.length, end + overscan) }
		: { start, end: start }
}

/** The group whose header sticks at the top of the viewport; null without headers. */
export function stickyHeader(layout: GridLayout, scrollTop: number): number | null {
	if (!layout.showHeaders || layout.rows.length === 0) {
		return null
	}
	const below = firstRowWhere(layout.rows, (row) => row.top + row.height > scrollTop)
	return layout.rows[Math.min(below, layout.rows.length - 1)]!.group
}

/** The index of the row that holds the picture at `index`. */
export function rowOfItem(layout: GridLayout, index: number): number {
	const { rows } = layout
	const after = firstRowWhere(rows, (row, at) => firstItem(rows, row, at) > index)
	const row = rows[after - 1]
	if (!Number.isInteger(index) || row?.kind !== 'tiles' || index >= row.first + row.count) {
		throw new RangeError(`The grid has no picture ${index}; pass an index from 0 to the picture count minus one.`)
	}
	return after - 1
}

/** The scroll offset that shows the picture at `index`: unchanged while its row is in view, else the row centred. */
export function revealScrollTop(layout: GridLayout, index: number, scrollTop: number, viewportHeight: number): number {
	const row = layout.rows[rowOfItem(layout, index)]!
	const inView = row.top >= scrollTop && row.top + row.height <= scrollTop + viewportHeight
	return inView ? scrollTop : Math.max(0, row.top - (viewportHeight - row.height) / 2)
}

/** The picture at a point of the grid's content, `gap` apart; a gap or a short row's end counts as the tile before it. */
export function tileAt(layout: GridLayout, gap: number, x: number, y: number): number | null {
	const row = layout.rows[firstRowWhere(layout.rows, (candidate) => candidate.top > y) - 1]
	if (row?.kind !== 'tiles') {
		return null
	}
	const column = Math.floor(x / (layout.tileWidth + gap))
	return row.first + Math.max(0, Math.min(row.count - 1, column))
}

/** The first picture of a row; a header's is that of the tile row below it. */
function firstItem(rows: readonly GridRow[], row: GridRow, at: number): number {
	return row.kind === 'tiles' ? row.first : firstItem(rows, rows[at + 1]!, at + 1)
}

/** The index of the first row that meets a condition false for every row before it; the row count if none does. */
function firstRowWhere(rows: readonly GridRow[], meets: (row: GridRow, at: number) => boolean): number {
	let low = 0
	let high = rows.length
	while (low < high) {
		const middle = (low + high) >>> 1
		if (meets(rows[middle]!, middle)) {
			high = middle
		} else {
			low = middle + 1
		}
	}
	return low
}

/** Where the grid's focus goes from the picture at `index`: up and down keep the column, clamped to a shorter row. */
export type FocusMove = 'previous' | 'next' | 'up' | 'down' | 'first' | 'last'

/** The picture the focus moves to; it stays at either end. */
export function focusStep(layout: GridLayout, index: number, move: FocusMove): number {
	const tiles = layout.rows.filter((row) => row.kind === 'tiles')
	const last = tiles.at(-1)!
	const count = last.first + last.count
	switch (move) {
		case 'first':
			return 0
		case 'last':
			return count - 1
		case 'previous':
			return Math.max(0, index - 1)
		case 'next':
			return Math.min(count - 1, index + 1)
	}
	const at = tiles.findIndex((row) => index < row.first + row.count)
	const target = tiles[at + (move === 'down' ? 1 : -1)]
	return target === undefined ? index : target.first + Math.min(index - tiles[at]!.first, target.count - 1)
}
