// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { buildHierarchy, findLevel } from '../../../src/logic/folder-hierarchy.ts'
import { allRows, cullSet, flatRows, opensLevel, ownRow, parentBelow, shownLevel, singleRow } from '../../../src/logic/folder-level.ts'
import { row } from './folder-fixtures.ts'

const ROWS = [
	row({ fileId: 1, path: '/Photos/2024' }),
	row({ fileId: 2, path: '/Photos/2024/Jura' }),
	row({ fileId: 3, path: '/Photos/2024/Iceland/Day 1' }),
	row({ fileId: 4, path: '/Photos/2024/Iceland/Day 2' }),
	row({ fileId: 5, root: '/Camera', path: '/Camera' }),
]
const TWO_ROOTS = buildHierarchy(['/Photos', '/Camera', '/Empty'], ROWS)
const ONE_ROOT = buildHierarchy(['/Photos'], ROWS)
const at = (path: string) => findLevel(TWO_ROOTS, path)!

describe('shownLevel', () => {
	// spec: FOLDERS-009.4
	it('shows the chosen level while the tree holds it, else the start: the only root or the Library', () => {
		expect(shownLevel(TWO_ROOTS, '/Photos/2024/Iceland')?.path).toBe('/Photos/2024/Iceland')
		expect(shownLevel(TWO_ROOTS, null)).toBeNull()
		expect(shownLevel(TWO_ROOTS, '/Photos/Gone')).toBeNull()
		expect(shownLevel(ONE_ROOT, null)?.path).toBe('/Photos')
		expect(shownLevel(ONE_ROOT, '/Camera')?.path).toBe('/Photos')
		expect(shownLevel([], null)).toBeNull()
	})
})

describe('allRows', () => {
	// spec: FOLDERS-009.2
	it('lists the roots with photos at the Library, labelled with their paths', () => {
		expect(allRows(TWO_ROOTS, null).map((each) => [each.label, each.node.path])).toEqual([['/Photos', '/Photos'], ['/Camera', '/Camera']])
	})

	it('lists the level\'s subfolders, a chain as one row', () => {
		const tree = buildHierarchy(['/Photos'], [row({ path: '/Photos/Archive/Analog/Scans' }), row({ fileId: 2, path: '/Photos/2024' })])
		expect(allRows(tree, findLevel(tree, '/Photos')).map((each) => [each.label, each.node.path])).toEqual([['2024', '/Photos/2024'], ['Archive / Analog / Scans', '/Photos/Archive/Analog/Scans']])
	})
})

describe('ownRow', () => {
	// spec: FOLDERS-009.8
	it('is the level\'s own row only when it also has subfolders with photos', () => {
		expect(ownRow(at('/Photos/2024'))?.fileId).toBe(1)
		expect(ownRow(at('/Photos/2024/Jura'))).toBeNull()
		expect(ownRow(at('/Photos/2024/Iceland'))).toBeNull()
		expect(ownRow(null)).toBeNull()
	})
})

describe('opensLevel', () => {
	// spec: FOLDERS-009.1, FOLDERS-009.3
	it('opens a row with subfolders, a chain and a root, but not a folder alone', () => {
		const tree = buildHierarchy(['/Photos'], [row({ path: '/Photos/Archive/Scans' }), ...ROWS])
		const rows = allRows(tree, findLevel(tree, '/Photos'))
		expect(rows.map((each) => [each.label, opensLevel(each)])).toEqual([['2024', true], ['Archive / Scans', true]])
		expect(opensLevel({ label: 'Jura', node: at('/Photos/2024/Jura') })).toBe(false)
		expect(allRows(TWO_ROOTS, null).map(opensLevel)).toEqual([true, true])
	})
})

describe('singleRow', () => {
	// spec: FOLDERS-009.1, FOLDERS-009.6
	it('is the node\'s own row when the switch is off or it has no subfolders, else null', () => {
		expect(singleRow(at('/Photos/2024'), true)).toBeNull()
		expect(singleRow(at('/Photos/2024'), false)?.fileId).toBe(1)
		expect(singleRow(at('/Photos/2024/Jura'), true)?.fileId).toBe(2)
		expect(singleRow(at('/Photos/2024/Iceland'), false)).toBeNull()
	})
})

describe('flatRows', () => {
	// spec: FOLDERS-009.14
	it('is every row below the level, the level\'s own first, or every row of the tree at the Library', () => {
		expect(flatRows(TWO_ROOTS, at('/Photos/2024')).map((each) => each.fileId)).toEqual([1, 3, 4, 2])
		expect(flatRows(TWO_ROOTS, null).map((each) => each.fileId)).toEqual([1, 3, 4, 2, 5])
	})

	it('leaves out a folder without photos, which the tree does not hold', () => {
		const tree = buildHierarchy(['/Photos'], [row({ fileId: 1, path: '/Photos/Empty', photos: 0 }), row({ fileId: 2, path: '/Photos/Full' })])
		expect(flatRows(tree, null).map((each) => each.fileId)).toEqual([2])
	})
})

describe('cullSet', () => {
	// spec: FOLDERS-009.6
	it('culls with subfolders when the switch is on and the node has subfolders with photos', () => {
		expect(cullSet(at('/Photos/2024'), true)).toEqual({ paths: ['/Photos/2024'], subfolders: true })
		expect(cullSet(at('/Photos/2024'), false)).toEqual({ paths: ['/Photos/2024'], subfolders: false })
		expect(cullSet(at('/Photos/2024/Jura'), true)).toEqual({ paths: ['/Photos/2024/Jura'], subfolders: false })
	})
})

describe('parentBelow', () => {
	// spec: FOLDERS-009.14
	it('is the parent path below the level, empty for the level and a folder directly in it', () => {
		const level = at('/Photos/2024')
		expect(parentBelow(level, '/Photos/2024/Iceland/Day 1')).toBe('Iceland')
		expect(parentBelow(level, '/Photos/2024/Iceland/Day 1/Raw')).toBe('Iceland/Day 1')
		expect(parentBelow(level, '/Photos/2024/Jura')).toBe('')
		expect(parentBelow(level, '/Photos/2024')).toBe('')
		expect(parentBelow(level, '/Photos/2024x/Jura')).toBe('')
	})
})
