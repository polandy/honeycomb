// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Branch, TreeFolder } from '../../../src/logic/folder-tree.ts'

import { describe, expect, it } from 'vitest'
import { foldersToExpand, ROOT, tickedBelow, treeKey, visibleRows } from '../../../src/logic/folder-tree.ts'

const folder = (path: string, hasSubfolders = false): TreeFolder => ({ name: path.split('/').pop()!, path, hasSubfolders })
const loaded = (...folders: TreeFolder[]): Branch => ({ state: 'loaded', folders })

const BRANCHES = new Map<string, Branch>([
	[ROOT, loaded(folder('/A', true), folder('/B', true), folder('/C'))],
	['/A', loaded(folder('/A/1', true), folder('/A/2'))],
	['/A/1', loaded(folder('/A/1/x'))],
	['/B', { state: 'loading' }],
])

/** The visible rows as `path@level` for folders and `note:parent@level` for notes. */
function shown(expanded: string[], branches = BRANCHES) {
	return visibleRows(branches, new Set(expanded)).map((row) => (row.kind === 'folder'
		? `${row.folder.path}@${row.level}${row.expanded ? '+' : ''}`
		: `${row.note}:${row.parent}@${row.level}`))
}

describe('visibleRows', () => {
	// spec: LISTING-003.4
	it('shows the root folders, collapsed', () => {
		expect(shown([])).toEqual(['/A@1', '/B@1', '/C@1'])
	})

	// spec: LISTING-003.4
	it('shows the child folders of every expanded folder below it, one level deeper', () => {
		expect(shown(['/A', '/A/1'])).toEqual(['/A@1+', '/A/1@2+', '/A/1/x@3', '/A/2@2', '/B@1', '/C@1'])
	})

	it('hides the children of an expanded folder under a collapsed one', () => {
		expect(shown(['/A/1'])).toEqual(['/A@1', '/B@1', '/C@1'])
	})

	it('never expands a folder without subfolders', () => {
		expect(shown(['/C'])).toEqual(['/A@1', '/B@1', '/C@1'])
	})

	// spec: LISTING-003.10
	it.each([
		['loading', { state: 'loading' }],
		['failed', { state: 'failed' }],
		['empty', { state: 'loaded', folders: [] }],
	] as const)('notes a %s branch under its folder', (note, branch) => {
		const branches = new Map([...BRANCHES, ['/B', branch]])

		expect(shown(['/B'], branches)).toEqual(['/A@1', '/B@1+', `${note}:/B@2`, '/C@1'])
	})

	it('notes the root while it loads', () => {
		expect(shown([], new Map())).toEqual([`loading:${ROOT}@1`])
	})
})

describe('treeKey', () => {
	const rows = visibleRows(BRANCHES, new Set(['/A', '/B']))

	// spec: LISTING-003.16
	it.each([
		['ArrowDown', '/A', { focus: '/A/1' }],
		['ArrowDown', '/C', null],
		['ArrowUp', '/A/1', { focus: '/A' }],
		['ArrowUp', '/A', null],
		['Home', '/B', { focus: '/A' }],
		['End', '/A', { focus: '/C' }],
		['ArrowRight', '/A/1', { expand: '/A/1' }],
		['ArrowRight', '/A', { focus: '/A/1' }],
		['ArrowRight', '/C', null],
		['ArrowLeft', '/A', { collapse: '/A' }],
		['ArrowLeft', '/A/2', { focus: '/A' }],
		['ArrowLeft', '/C', null],
		['Enter', '/A', null],
	])('%s on %s: %o', (key, path, move) => {
		expect(treeKey(rows, path, key)).toEqual(move)
	})

	it('skips a note row on the way down', () => {
		expect(treeKey(rows, '/B', 'ArrowDown')).toEqual({ focus: '/C' })
	})

	it('stays put when the children of an expanded folder are still loading', () => {
		expect(treeKey(rows, '/B', 'ArrowRight')).toBeNull()
	})

	it('ignores a folder that is not shown', () => {
		expect(treeKey(rows, '/gone', 'ArrowDown')).toBeNull()
	})
})

describe('foldersToExpand', () => {
	// spec: LISTING-003.11
	it('expands the folders above every ticked one, outermost first, each once', () => {
		expect(foldersToExpand(['/A/1/x', '/A/2', '/C'])).toEqual(['/A', '/A/1'])
	})

	it('expands nothing for root folders', () => {
		expect(foldersToExpand(['/A'])).toEqual([])
	})
})

describe('tickedBelow', () => {
	// spec: LISTING-003.17
	it('counts the ticked folders at any depth below a folder, but not the folder itself', () => {
		expect(tickedBelow(['/A', '/A/1', '/A/1/x', '/B/1'], '/A')).toBe(2)
	})

	it('does not count a folder whose name only starts with the same letters', () => {
		expect(tickedBelow(['/AB', '/AB/1'], '/A')).toBe(0)
	})
})
