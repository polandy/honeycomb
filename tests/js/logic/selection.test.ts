// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Selection } from '../../../src/logic/selection.ts'

import { describe, expect, it } from 'vitest'
import { addSelected, dragSelection, keepShown, NO_SELECTION, selectAll, selectionAfterClick } from '../../../src/logic/selection.ts'

const ORDER = [10, 20, 30, 40, 50]
const selection = (ids: number[], anchor: number | null = null): Selection => ({ ids: new Set(ids), anchor })
const plain = { shift: false, toggle: false }

describe('selectionAfterClick', () => {
	it('leaves a plain click outside selection mode to the grid', () => {
		expect(selectionAfterClick(false, NO_SELECTION, ORDER, 20, plain)).toBeNull()
	})

	// spec: GRID-003.3
	it('toggles the tile and moves the anchor in selection mode', () => {
		const added = selectionAfterClick(true, selection([10], 10), ORDER, 30, plain)!

		expect([...added.ids]).toEqual([10, 30])
		expect(added.anchor).toBe(30)
		expect([...selectionAfterClick(true, added, ORDER, 10, plain)!.ids]).toEqual([30])
	})

	// spec: GRID-003.3
	it('toggles with Ctrl or Cmd outside selection mode too', () => {
		expect(selectionAfterClick(false, NO_SELECTION, ORDER, 40, { shift: false, toggle: true })).toEqual(selection([40], 40))
	})

	it.each([
		['forward', 20, 40, [20, 30, 40]],
		['backward', 40, 10, [40, 10, 20, 30]],
	])('adds the range from the anchor with Shift, %s', (_, anchor, clicked, expected) => {
		const ranged = selectionAfterClick(true, selection([anchor], anchor), ORDER, clicked, { shift: true, toggle: false })!

		expect([...ranged.ids]).toEqual(expected)
		expect(ranged.anchor).toBe(anchor)
	})

	// spec: GRID-003.3
	it('toggles with Shift when there is no anchor or it left the view', () => {
		expect(selectionAfterClick(true, NO_SELECTION, ORDER, 20, { shift: true, toggle: false })).toEqual(selection([20], 20))
		expect(selectionAfterClick(true, selection([], 99), ORDER, 20, { shift: true, toggle: false })).toEqual(selection([20], 20))
	})
})

describe('addSelected', () => {
	it('adds the tile and anchors there, and never removes it', () => {
		const once = addSelected(selection([10], 10), 30)

		expect(once).toEqual(selection([10, 30], 30))
		expect(addSelected(once, 30)).toEqual(once)
	})
})

describe('selectAll', () => {
	// spec: GRID-003.4
	it('selects every shown picture and keeps the anchor', () => {
		expect(selectAll(selection([20], 20), ORDER)).toEqual(selection(ORDER, 20))
	})
})

describe('keepShown', () => {
	// spec: GRID-003.8
	it('drops the pictures that left the view and the anchor with them', () => {
		expect(keepShown(selection([10, 99, 30], 99), ORDER)).toEqual(selection([10, 30], null))
	})

	it('returns the same selection while every picture is shown', () => {
		const kept = selection([10, 30], 30)

		expect(keepShown(kept, ORDER)).toBe(kept)
	})
})

describe('dragSelection', () => {
	// spec: GRID-003.11
	it.each([
		['forwards', 1, 3, [20, 30, 40]],
		['backwards', 3, 1, [20, 30, 40]],
		['on the pressed tile alone', 2, 2, [30]],
	])('selects the range %s from the pressed tile, which is the anchor', (_, from, to, ids) => {
		expect(dragSelection(NO_SELECTION, ORDER, from, to)).toEqual(selection(ids, ORDER[from]))
	})

	// spec: GRID-003.11
	it('adds to what was selected before the drag and never removes it', () => {
		const before = selection([10, 50], 50)

		expect(dragSelection(before, ORDER, 1, 2)).toEqual(selection([10, 50, 20, 30], 20))
		expect(dragSelection(before, ORDER, 4, 3)).toEqual(selection([10, 50, 40], 50))
	})
})
