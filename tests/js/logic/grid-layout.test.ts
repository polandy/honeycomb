// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { GridLayoutInput } from '../../../src/logic/grid-layout.ts'

import { describe, expect, it } from 'vitest'
import { focusStep, gridLayout, rowOfItem, stickyHeader, visibleRows } from '../../../src/logic/grid-layout.ts'

// Two columns of 100 px tiles with a 10 px gap, two groups of 3 and 5 pictures.
const GROUPED: GridLayoutInput = { width: 210, tileSize: 100, gap: 10, headerHeight: 30, groups: [3, 5], showHeaders: true }

describe('gridLayout', () => {
	it.each([
		['fits as many target-sized tiles as the width holds and stretches them', 1000, 160, 4, 6, (1000 - 5 * 4) / 6],
		['keeps one column narrower than a tile', 120, 160, 4, 1, 120],
		['fits an exact multiple without stretching', 210, 100, 10, 2, 100],
	])('%s', (_case, width, tileSize, gap, columns, tileWidth) => {
		const layout = gridLayout({ ...GROUPED, width, tileSize, gap })

		expect(layout.columns).toBe(columns)
		expect(layout.tileWidth).toBeCloseTo(tileWidth)
	})

	it('puts a header above each group and breaks rows at a group\'s end', () => {
		const layout = gridLayout(GROUPED)

		expect(layout.rows).toEqual([
			{ kind: 'header', group: 0, top: 0, height: 30 },
			{ kind: 'tiles', group: 0, first: 0, count: 2, top: 40, height: 100 },
			{ kind: 'tiles', group: 0, first: 2, count: 1, top: 150, height: 100 },
			{ kind: 'header', group: 1, top: 260, height: 30 },
			{ kind: 'tiles', group: 1, first: 3, count: 2, top: 300, height: 100 },
			{ kind: 'tiles', group: 1, first: 5, count: 2, top: 410, height: 100 },
			{ kind: 'tiles', group: 1, first: 7, count: 1, top: 520, height: 100 },
		])
		expect(layout.totalHeight).toBe(620)
	})

	it('has tile rows only without headers', () => {
		const layout = gridLayout({ ...GROUPED, groups: [3], showHeaders: false })

		expect(layout.rows).toEqual([
			{ kind: 'tiles', group: 0, first: 0, count: 2, top: 0, height: 100 },
			{ kind: 'tiles', group: 0, first: 2, count: 1, top: 110, height: 100 },
		])
		expect(layout.totalHeight).toBe(210)
	})

	it('skips an empty group', () => {
		const layout = gridLayout({ ...GROUPED, groups: [0, 1] })

		expect(layout.rows.map((row) => [row.kind, row.group])).toEqual([['header', 1], ['tiles', 1]])
	})

	it('has no rows and no height without pictures', () => {
		const layout = gridLayout({ ...GROUPED, groups: [] })

		expect(layout.rows).toEqual([])
		expect(layout.totalHeight).toBe(0)
	})
})

describe('visibleRows', () => {
	const layout = gridLayout(GROUPED)

	it.each([
		['the rows the viewport crosses', 145, 100, 0, { start: 2, end: 3 }],
		['the overscan rows on each side', 145, 100, 1, { start: 1, end: 4 }],
		['no rows before the first or after the last', 0, 1000, 5, { start: 0, end: 7 }],
		['no rows in a gap between rows', 142, 5, 0, { start: 2, end: 2 }],
		['no rows below the end', 700, 100, 0, { start: 7, end: 7 }],
	])('gives %s', (_case, scrollTop, viewportHeight, overscan, range) => {
		expect(visibleRows(layout, scrollTop, viewportHeight, overscan)).toEqual(range)
	})

	it('gives nothing for an empty grid', () => {
		expect(visibleRows(gridLayout({ ...GROUPED, groups: [] }), 0, 500, 2)).toEqual({ start: 0, end: 0 })
	})
})

describe('stickyHeader', () => {
	const layout = gridLayout(GROUPED)

	it.each([
		['the first group at the top', 0, 0],
		['the group whose tiles cross the top', 200, 0],
		['the next group in the gap above its header', 255, 1],
		['the last group below the end', 900, 1],
	])('sticks %s', (_case, scrollTop, group) => {
		expect(stickyHeader(layout, scrollTop)).toBe(group)
	})

	it('sticks nothing without headers', () => {
		expect(stickyHeader(gridLayout({ ...GROUPED, showHeaders: false }), 0)).toBeNull()
	})

	it('sticks nothing in an empty grid', () => {
		expect(stickyHeader(gridLayout({ ...GROUPED, groups: [] }), 0)).toBeNull()
	})
})

describe('rowOfItem', () => {
	const layout = gridLayout(GROUPED)

	it.each([[0, 1], [1, 1], [2, 2], [3, 4], [6, 5], [7, 6]])('finds item %d in row %d', (index, row) => {
		expect(rowOfItem(layout, index)).toBe(row)
	})

	it.each([-1, 8, 1.5])('rejects the item index %d', (index) => {
		expect(() => rowOfItem(layout, index)).toThrow(RangeError)
	})
})

describe('a grid of 20,000 pictures in 100 folders', () => {
	const layout = gridLayout({ width: 1000, tileSize: 160, gap: 4, headerHeight: 40, groups: Array.from({ length: 100 }, () => 200), showHeaders: true })

	it('holds every picture once', () => {
		const tiles = layout.rows.filter((row) => row.kind === 'tiles')

		expect(tiles.reduce((sum, row) => sum + row.count, 0)).toBe(20_000)
		expect(layout.rows).toHaveLength(100 * (1 + Math.ceil(200 / 6)))
	})

	it('finds the row of every picture', () => {
		for (let index = 0; index < 20_000; index++) {
			const row = layout.rows[rowOfItem(layout, index)]!
			expect(row.kind === 'tiles' && row.first <= index && index < row.first + row.count).toBe(true)
		}
	})

	it('gives the rows the viewport crosses deep down', () => {
		const scrollTop = layout.totalHeight / 2
		const { start, end } = visibleRows(layout, scrollTop, 800, 0)
		const crossing = layout.rows.flatMap((row, index) => (row.top < scrollTop + 800 && row.top + row.height > scrollTop ? [index] : []))

		expect([start, end]).toEqual([crossing[0], crossing.at(-1)! + 1])
	})
})

describe('focusStep', () => {
	// Rows: header, [0 1], [2], header, [3 4], [5 6], [7].
	const layout = gridLayout(GROUPED)

	it.each([
		['previous', 3, 2],
		['previous', 0, 0],
		['next', 2, 3],
		['next', 7, 7],
		['first', 5, 0],
		['last', 1, 7],
		['down', 1, 2],
		['down', 2, 3],
		['down', 6, 7],
		['down', 7, 7],
		['up', 3, 2],
		['up', 4, 2],
		['up', 0, 0],
	] as const)('moves %s from %i to %i, across group headers and onto shorter rows', (move, from, to) => {
		expect(focusStep(layout, from, move)).toBe(to)
	})
})
