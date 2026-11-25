// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderNode } from '../../../src/logic/folder-hierarchy.ts'

import { describe, expect, it } from 'vitest'
import { breadcrumb, buildHierarchy, findLevel, levelRows, scopeSums, startLevel, subtreeRows, subtreeState } from '../../../src/logic/folder-hierarchy.ts'
import { doneRow, row } from './folder-fixtures.ts'

const names = (nodes: readonly FolderNode[]) => nodes.map((node) => node.name)
const level = (tree: readonly FolderNode[], path: string) => findLevel(tree, path)!
const readOnly = 1

describe('buildHierarchy', () => {
	// spec: FOLDERS-009.1
	it('adds a level for a folder without photos of its own when photos lie below it', () => {
		const tree = buildHierarchy(['/Photos'], [
			row({ fileId: 1, path: '/Photos/2024/Iceland/Day 1' }),
			row({ fileId: 2, path: '/Photos/2024/Iceland/Day 2' }),
			row({ fileId: 3, path: '/Photos/2024/Iceland/Day 3' }),
		])
		const iceland = level(tree, '/Photos/2024/Iceland')
		expect(iceland).toMatchObject({ name: 'Iceland', root: '/Photos', row: null })
		expect(names(iceland.children)).toEqual(['Day 1', 'Day 2', 'Day 3'])
		expect(level(tree, '/Photos/2024').row).toBeNull()
		expect(level(tree, '/Photos/2024/Iceland/Day 2').row?.fileId).toBe(2)
	})

	// spec: FOLDERS-009.2
	it('has no node for a folder without photos in its subtree', () => {
		const tree = buildHierarchy(['/Photos'], [row({ path: '/Photos/2024' }), row({ fileId: 2, path: '/Photos/Documents/Receipts', photos: 0, undecided: 0, picked: 0, rejected: 0 })])
		expect(names(tree[0].children)).toEqual(['2024'])
		expect(findLevel(tree, '/Photos/Documents')).toBeNull()
		expect(findLevel(tree, '/Photos/Documents/Receipts')).toBeNull()
	})

	it('keeps every root in the roots order, also one without photos, and the root row as its own photos', () => {
		const tree = buildHierarchy(['/Photos', '/Empty', '/Camera'], [row({ root: '/Camera', path: '/Camera' }), row({ fileId: 2, path: '/Photos/a' })])
		expect(tree.map((node) => [node.name, node.path, node.children.length])).toEqual([['Photos', '/Photos', 1], ['Empty', '/Empty', 0], ['Camera', '/Camera', 0]])
		expect(tree[2].row?.path).toBe('/Camera')
		expect(tree[0].row).toBeNull()
	})

	it('leaves out rows of an unknown root and rows outside their root', () => {
		const tree = buildHierarchy(['/Photos'], [row({ root: '/Other', path: '/Other/a' }), row({ fileId: 2, path: '/Photoshop/a' }), row({ fileId: 3, path: '/Photos/b' })])
		expect(names(tree[0].children)).toEqual(['b'])
		expect(subtreeRows(tree[0]).map((folder) => folder.fileId)).toEqual([3])
	})

	it('sorts subfolders in natural order, code points breaking case-only ties', () => {
		const tree = buildHierarchy(['/Photos'], ['Day 10', 'day 2', 'Day 2', 'Day 1'].map((name, index) => row({ fileId: index, path: `/Photos/${name}` })))
		expect(names(tree[0].children)).toEqual(['Day 1', 'Day 2', 'day 2', 'Day 10'])
	})

	it('is empty without roots', () => {
		expect(buildHierarchy([], [row()])).toEqual([])
	})
})

describe('findLevel and startLevel', () => {
	it('finds a root and a level below it, null for a path the tree does not hold', () => {
		const tree = buildHierarchy(['/Photos', '/Camera'], [row({ path: '/Photos/a/b' })])
		expect(level(tree, '/Camera').name).toBe('Camera')
		expect(level(tree, '/Photos/a').name).toBe('a')
		expect(findLevel(tree, '/Photos/a/c')).toBeNull()
		expect(findLevel(tree, '/Elsewhere')).toBeNull()
	})

	// spec: FOLDERS-009.4
	it('starts inside the root when there is one, else at the Library', () => {
		expect(startLevel(buildHierarchy(['/Photos'], []))).toBe('/Photos')
		expect(startLevel(buildHierarchy(['/Photos', '/Camera'], []))).toBeNull()
		expect(startLevel([])).toBeNull()
	})
})

describe('scopeSums', () => {
	const tree = buildHierarchy(['/Photos'], [
		row({ fileId: 1, path: '/Photos/Trip', photos: 3, picked: 1, rejected: 1, undecided: 1, bytes: 30 }),
		row({ fileId: 2, path: '/Photos/Trip/Day 1', photos: 2, picked: 0, rejected: 0, undecided: 2, bytes: 20, permissions: readOnly }),
		doneRow({ fileId: 3, path: '/Photos/Trip/Day 2', photos: 112, picked: 112, rejected: 0, bytes: 5 }, 100),
		doneRow({ fileId: 4, path: '/Photos/Trip/Day 2/Night', photos: 5, picked: 5, rejected: 0, bytes: 1, permissions: readOnly }, 0),
	])

	// spec: FOLDERS-009.7
	it('sums the subtree with subfolders, each folder once, and its own photos without', () => {
		const trip = level(tree, '/Photos/Trip')
		expect(scopeSums(trip, true)).toEqual({ photos: 122, picked: 118, rejected: 1, undecided: 3, bytes: 56, folders: 4, rateable: 2, done: 1, fresh: 17 })
		expect(scopeSums(trip, false)).toEqual({ photos: 3, picked: 1, rejected: 1, undecided: 1, bytes: 30, folders: 1, rateable: 1, done: 0, fresh: 0 })
	})

	// spec: FOLDERS-009.15
	it('sums the new photos of the done folders below, read-only ones too', () => {
		expect(scopeSums(level(tree, '/Photos/Trip/Day 2'), true).fresh).toBe(17)
	})

	// spec: FOLDERS-009.1
	it('is zero for a level without photos of its own when the subfolders are left out', () => {
		const sums = scopeSums(tree[0], false)
		expect(sums).toEqual({ photos: 0, picked: 0, rejected: 0, undecided: 0, bytes: 0, folders: 0, rateable: 0, done: 0, fresh: 0 })
		expect(subtreeState(sums)).toBe('empty')
		expect(scopeSums(tree[0], true).photos).toBe(122)
	})

	it('lists the rows of the subtree, the level first, then depth first in natural order', () => {
		expect(subtreeRows(tree[0]).map((folder) => folder.fileId)).toEqual([1, 2, 3, 4])
		expect(subtreeRows(level(tree, '/Photos/Trip/Day 2')).map((folder) => folder.fileId)).toEqual([3, 4])
	})
})

describe('subtreeState', () => {
	const subtree = (rows: readonly Parameters<typeof row>[0][]) => scopeSums(buildHierarchy(['/Photos'], rows.map((overrides, index) => row({ ...overrides, fileId: index, path: `/Photos/t/${index}` })))[0], true)
	const done = (overrides: Parameters<typeof row>[0] = {}) => doneRow(overrides)

	// spec: FOLDERS-009.9
	it('reads k of n with undecided photos left and leaves read-only folders out of both numbers', () => {
		const open = subtree([done(), done(), {}, {}, {}, { permissions: readOnly }])
		expect([subtreeState(open), open.rateable, open.done]).toEqual(['open', 5, 2])
		const allDone = subtree([done(), done(), done(), done(), done(), { permissions: readOnly }])
		expect([subtreeState(allDone), allDone.rateable, allDone.done]).toEqual(['done', 5, 5])
	})

	// spec: FOLDERS-009.10
	it('is complete with no undecided photo and a rateable folder not done', () => {
		const sums = subtree([done(), { undecided: 0, picked: 100 }, { undecided: 0, picked: 50, rejected: 50 }])
		expect([subtreeState(sums), sums.rateable - sums.done]).toEqual(['complete', 2])
	})

	it('is done before complete and open, read-only when no folder can be marked, empty without photos', () => {
		expect(subtreeState(subtree([done()]))).toBe('done')
		expect(subtreeState(subtree([done({ photos: 140 }), { undecided: 5, permissions: readOnly }]))).toBe('done')
		expect(subtreeState(subtree([{ permissions: readOnly }, { permissions: readOnly, undecided: 0, picked: 100 }]))).toBe('read-only')
		expect(subtreeState(subtree([]))).toBe('empty')
	})
})

describe('levelRows', () => {
	// spec: FOLDERS-009.3
	it('collapses a chain of folders without photos of their own into one row', () => {
		const tree = buildHierarchy(['/Photos'], [1, 2, 3].map((roll) => row({ fileId: roll, path: `/Photos/Archive/Analog/Scans 1998/Roll 0${roll}` })))
		const rows = levelRows(tree[0])
		expect(rows.map((entry) => [entry.label, entry.node.path])).toEqual([['Archive / Analog / Scans 1998', '/Photos/Archive/Analog/Scans 1998']])
	})

	it('ends a chain at a folder with photos of its own and at a single folder without subfolders', () => {
		const tree = buildHierarchy(['/Photos'], [
			row({ fileId: 1, path: '/Photos/A/B' }),
			row({ fileId: 2, path: '/Photos/A/B/C' }),
			row({ fileId: 3, path: '/Photos/Only/Leaf' }),
			row({ fileId: 4, path: '/Photos/Own' }),
			row({ fileId: 5, path: '/Photos/Own/Below' }),
			row({ fileId: 6, path: '/Photos/Two/x' }),
			row({ fileId: 7, path: '/Photos/Two/y' }),
		])
		expect(levelRows(tree[0]).map((entry) => [entry.label, entry.node.path])).toEqual([
			['A / B', '/Photos/A/B'],
			['Only / Leaf', '/Photos/Only/Leaf'],
			['Own', '/Photos/Own'],
			['Two', '/Photos/Two'],
		])
	})

	it('has no rows for a level without subfolders', () => {
		const tree = buildHierarchy(['/Photos'], [row({ path: '/Photos' })])
		expect(levelRows(tree[0])).toEqual([])
	})
})

describe('breadcrumb', () => {
	const crumb = (path: string) => ({ kind: 'level', name: path.split('/').pop(), path })

	// spec: FOLDERS-009.4
	it('shows the first level, a gap with the levels between and the last two above 4 levels', () => {
		expect(breadcrumb('/Photos', '/Photos/2024/Iceland/Day 1/Raw')).toEqual([
			crumb('/Photos'),
			{ kind: 'gap', levels: [crumb('/Photos/2024'), crumb('/Photos/2024/Iceland')] },
			crumb('/Photos/2024/Iceland/Day 1'),
			crumb('/Photos/2024/Iceland/Day 1/Raw'),
		])
	})

	// spec: FOLDERS-009.4
	it('shows up to 4 levels in full and starts at the root, never above it', () => {
		expect(breadcrumb('/Photos', '/Photos/2024/Iceland/Day 1')).toEqual(['/Photos', '/Photos/2024', '/Photos/2024/Iceland', '/Photos/2024/Iceland/Day 1'].map(crumb))
		expect(breadcrumb('/Shared/Photos', '/Shared/Photos')).toEqual([{ kind: 'level', name: 'Photos', path: '/Shared/Photos' }])
	})

	it('is empty for a path outside the root', () => {
		expect(breadcrumb('/Photos', '/Photoshop/a')).toEqual([])
		expect(breadcrumb('/Photos', '/')).toEqual([])
	})
})
