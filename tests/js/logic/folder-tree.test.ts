// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Branch, TreeFolder } from '../../../src/logic/folder-tree.ts'

import { describe, expect, it } from 'vitest'
import { excludedBelow, excludedFrom, foldersToExpand, includedBy, ROOT, rowPhotoFiles, tickedBelow, treeKey, visibleRows } from '../../../src/logic/folder-tree.ts'

const folder = (path: string, hasSubfolders = false): TreeFolder => ({ name: path.split('/').pop()!, path, hasSubfolders, photoFiles: 0, photoFilesBelow: 0 })
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

describe('includedBy', () => {
	// spec: LISTING-003.18
	it('names the nearest ticked folder above a folder that is not ticked itself', () => {
		expect(includedBy({ paths: ['/A', '/A/1'] }, '/A/1/x/y')).toBe('/A/1')
		expect(includedBy({ paths: ['/A'] }, '/A/1')).toBe('/A')
	})

	// spec: LISTING-003.18
	it('leaves out a ticked folder, one with no ticked folder above it, and a look-alike name', () => {
		expect(includedBy({ paths: ['/A', '/A/1'] }, '/A/1')).toBeNull()
		expect(includedBy({ paths: ['/A/1'] }, '/A')).toBeNull()
		expect(includedBy({ paths: ['/A'] }, '/AB/1')).toBeNull()
	})

	// spec: LISTING-003.18
	it('leaves out a hidden folder and every folder inside one, which the listing skips', () => {
		expect(includedBy({ paths: ['/A'] }, '/A/.cache')).toBeNull()
		expect(includedBy({ paths: ['/A'] }, '/A/.cache/1')).toBeNull()
	})

	// spec: LISTING-003.21
	it('leaves out an excluded folder and every folder inside it, but not a ticked one inside it', () => {
		const set = { paths: ['/A', '/A/1/x'], excluded: ['/A/1'] }

		expect(includedBy(set, '/A/1')).toBeNull()
		expect(includedBy(set, '/A/1/y')).toBeNull()
		expect(includedBy(set, '/A/1/x/z')).toBe('/A/1/x')
		expect(includedBy(set, '/A/2')).toBe('/A')
	})
})

describe('excludedFrom', () => {
	// spec: LISTING-003.21
	it('names the ticked folder an excluded folder is left out of', () => {
		expect(excludedFrom({ paths: ['/A'], subfolders: true, excluded: ['/A/1/x'] }, '/A/1/x')).toBe('/A')
	})

	// spec: LISTING-003.22
	it.each([
		['a folder not excluded', { paths: ['/A'], subfolders: true, excluded: ['/A/1'] }, '/A/2'],
		['the switch off', { paths: ['/A'], subfolders: false, excluded: ['/A/1'] }, '/A/1'],
		['no ticked folder above', { paths: ['/B'], subfolders: true, excluded: ['/A/1'] }, '/A/1'],
		['an excluded folder above', { paths: ['/A'], subfolders: true, excluded: ['/A/1', '/A/1/x'] }, '/A/1/x'],
	])('gives none for %s', (_case, set, path) => {
		expect(excludedFrom(set, path)).toBeNull()
	})
})

describe('excludedBelow', () => {
	// spec: LISTING-003.22
	it('counts the excluded folders that leave something out at any depth below a folder, but not the folder itself', () => {
		const set = { paths: ['/A', '/B'], subfolders: true, excluded: ['/A/1', '/A/1/x', '/A/2/y', '/B', '/C/1'] }

		expect(excludedBelow(set, '/A')).toBe(2)
		expect(excludedBelow(set, '/A/1')).toBe(0)
		expect(excludedBelow(set, '')).toBe(2)
		expect(excludedBelow({ ...set, subfolders: false }, '/A')).toBe(0)
	})
})

describe('rowPhotoFiles', () => {
	const counted = (hasSubfolders: boolean, photoFiles: number | null, photoFilesBelow: number | null): TreeFolder => ({ name: 'A', path: '/A', hasSubfolders, photoFiles, photoFilesBelow })

	// spec: LISTING-003.20
	it('counts the files below a collapsed folder with subfolders', () => {
		expect(rowPhotoFiles(counted(true, 3, 1203), false)).toEqual({ count: 1203, below: true })
	})

	// spec: LISTING-003.20
	it('counts its own files while expanded or without subfolders', () => {
		expect(rowPhotoFiles(counted(true, 3, 1203), true)).toEqual({ count: 3, below: false })
		expect(rowPhotoFiles(counted(false, 2, 2), false)).toEqual({ count: 2, below: false })
	})

	// spec: LISTING-003.19, LISTING-003.20
	it('counts nothing for none or an unknown count', () => {
		expect(rowPhotoFiles(counted(true, 3, 0), false)).toBeNull()
		expect(rowPhotoFiles(counted(true, 3, null), false)).toBeNull()
		expect(rowPhotoFiles(counted(true, 0, 9), true)).toBeNull()
		expect(rowPhotoFiles(counted(false, null, null), false)).toBeNull()
	})
})
