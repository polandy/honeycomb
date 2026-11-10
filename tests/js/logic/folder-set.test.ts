// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { breadcrumbs, folderSetKey, isHiddenFolder, summarise, toggleFolder } from '../../../src/logic/folder-set.ts'

describe('toggleFolder', () => {
	it.each([
		['adds an unticked folder in sorted order', ['/A', '/C'], '/B', ['/A', '/B', '/C']],
		['removes a ticked folder', ['/A', '/B', '/C'], '/B', ['/A', '/C']],
		['ticks the first folder', [], '/A', ['/A']],
	])('%s', (_case, paths, path, expected) => {
		expect(toggleFolder(paths, path)).toEqual(expected)
	})

	it('leaves the given paths unchanged', () => {
		const paths = ['/A']

		toggleFolder(paths, '/B')

		expect(paths).toEqual(['/A'])
	})
})

describe('isHiddenFolder', () => {
	it.each([
		['.thumbnails', true],
		['.', true],
		['Photos', false],
		['2026.11.09', false],
	])('%s is hidden: %s', (name, hidden) => {
		expect(isHiddenFolder(name)).toBe(hidden)
	})
})

describe('breadcrumbs', () => {
	it('starts at the root, whose path is empty', () => {
		expect(breadcrumbs('/Photos/2026')).toEqual([
			{ name: '', path: '' },
			{ name: 'Photos', path: '/Photos' },
			{ name: '2026', path: '/Photos/2026' },
		])
	})

	it.each(['', '/'])('gives only the root for "%s"', (path) => {
		expect(breadcrumbs(path)).toEqual([{ name: '', path: '' }])
	})

	it('ignores a missing leading slash and a trailing slash', () => {
		expect(breadcrumbs('Photos/')).toEqual([{ name: '', path: '' }, { name: 'Photos', path: '/Photos' }])
	})
})

describe('folderSetKey', () => {
	it('is the same for the same folders in any order', () => {
		expect(folderSetKey({ paths: ['/B', '/A'], subfolders: true })).toBe(folderSetKey({ paths: ['/A', '/B'], subfolders: true }))
	})

	it.each([
		['subfolders', { paths: ['/A'], subfolders: true }, { paths: ['/A'], subfolders: false }],
		['folders', { paths: ['/A'], subfolders: false }, { paths: ['/B'], subfolders: false }],
		['a comma in a name', { paths: ['/A,/B'], subfolders: false }, { paths: ['/A', '/B'], subfolders: false }],
	])('differs by %s', (_case, first, second) => {
		expect(folderSetKey(first)).not.toBe(folderSetKey(second))
	})
})

describe('summarise', () => {
	it('counts the pictures and their distinct folders', () => {
		const pictures = [{ folder: '/A' }, { folder: '/B' }, { folder: '/A' }]

		expect(summarise(pictures)).toEqual({ pictures: 3, folders: 2 })
	})

	it('counts nothing for no pictures', () => {
		expect(summarise([])).toEqual({ pictures: 0, folders: 0 })
	})
})
