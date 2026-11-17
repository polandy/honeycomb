// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { breadcrumbs, folderListings, folderSetKey, isHiddenFolder, summarise, tapFolder, tickAbove, toggleFolder } from '../../../src/logic/folder-set.ts'

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

	// spec: DECISIONS-002.15
	it.each([
		['a ticked subfolder', ['/Trip/Day 2', '/Trip'], ['/Trip']],
		['a ticked folder deeper down', ['/Trip', '/Trip/Day 2/Raw'], ['/Trip']],
		['every folder below the root', ['', '/Trip'], ['']],
	])('leaves out %s of a ticked folder with subfolders', (_case, paths, covering) => {
		expect(folderSetKey({ paths, subfolders: true })).toBe(folderSetKey({ paths: covering, subfolders: true }))
	})

	// spec: DECISIONS-002.15
	it.each([
		['without subfolders', ['/Trip', '/Trip/Day 2'], false],
		['for a sibling that starts with the same name', ['/Trip', '/Trip 2'], true],
		['for a folder that only starts with the same name', ['/Trip', '/Trips/Day 1'], true],
	])('keeps every folder %s', (_case, paths, subfolders) => {
		expect(folderSetKey({ paths, subfolders })).not.toBe(folderSetKey({ paths: ['/Trip'], subfolders }))
	})

	// spec: DECISIONS-002.15
	it('is the form the server hashes, FolderSet::key()', () => {
		expect(folderSetKey({ paths: ['/Trip/Day 2', '/Fotos/ä', '/Trip'], subfolders: true })).toBe('[["/Fotos/ä","/Trip"],true]')
	})

	// spec: DECISIONS-002.16
	it('names the excluded folders after the paths, sorted, in the form the server hashes', () => {
		expect(folderSetKey({ paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Raw', '/Trip/Day 2', '/Trip/Raw'] }))
			.toBe('[["/Trip"],true,["/Trip/Day 2","/Trip/Raw"]]')
	})

	// spec: DECISIONS-002.16
	it.each([
		['without subfolders', { paths: ['/Trip'], subfolders: false, excluded: ['/Trip/Raw'] }, { paths: ['/Trip'], subfolders: false }],
		['with no ticked folder above', { paths: ['/Trip'], subfolders: true, excluded: ['/Other/Raw', '/Trips/Raw'] }, { paths: ['/Trip'], subfolders: true }],
		['inside an excluded one', { paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Raw', '/Trip/Raw/Old'] }, { paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Raw'] }],
		['that is ticked itself', { paths: ['/Trip', '/Trip/Raw'], subfolders: true, excluded: ['/Trip/Raw'] }, { paths: ['/Trip'], subfolders: true }],
		['when none is left', { paths: ['/Trip'], subfolders: true, excluded: [] }, { paths: ['/Trip'], subfolders: true }],
	])('leaves out excluded folders %s', (_case, set, same) => {
		expect(folderSetKey(set)).toBe(folderSetKey(same))
	})

	// spec: DECISIONS-002.16
	it('keeps a ticked folder inside an excluded one, which the excluded one would leave out', () => {
		expect(folderSetKey({ paths: ['/Trip', '/Trip/Raw/Best'], subfolders: true, excluded: ['/Trip/Raw'] }))
			.toBe('[["/Trip","/Trip/Raw/Best"],true,["/Trip/Raw"]]')
	})

	// spec: DECISIONS-002.16
	it('differs by an excluded folder', () => {
		expect(folderSetKey({ paths: ['/Trip'], subfolders: true, excluded: ['/Trip/Raw'] })).not.toBe(folderSetKey({ paths: ['/Trip'], subfolders: true }))
	})
})

describe('tickAbove', () => {
	// spec: LISTING-003.21
	it.each([
		['the nearest ticked folder above', { paths: ['/A', '/A/1'], excluded: [] }, '/A/1/x/y', '/A/1'],
		['the root when it is ticked', { paths: [''], excluded: [] }, '/A', ''],
		['none for a look-alike name', { paths: ['/A'], excluded: [] }, '/AB/1', null],
		['none for the ticked folder itself only', { paths: ['/A/1'], excluded: [] }, '/A/1', null],
		['none past an excluded folder', { paths: ['/A'], excluded: ['/A/1'] }, '/A/1/x', null],
		['a ticked folder inside an excluded one', { paths: ['/A', '/A/1/x'], excluded: ['/A/1'] }, '/A/1/x/y', '/A/1/x'],
		['the folder above an excluded one', { paths: ['/A'], excluded: ['/A/1'] }, '/A/1', '/A'],
	])('gives %s', (_case, set, path, expected) => {
		expect(tickAbove(set, path)).toBe(expected)
	})
})

describe('tapFolder', () => {
	const trip = { paths: ['/Trip'], subfolders: true }

	// spec: LISTING-003.4
	it('ticks and unticks a folder as before without subfolders', () => {
		expect(tapFolder({ paths: ['/Trip'], subfolders: false }, '/Trip/Raw')).toEqual({ paths: ['/Trip', '/Trip/Raw'], subfolders: false })
		expect(tapFolder({ paths: ['/Trip', '/Trip/Raw'], subfolders: false }, '/Trip/Raw')).toEqual({ paths: ['/Trip'], subfolders: false })
	})

	// spec: LISTING-003.21
	it('excludes an included folder, and includes it again on the next tap', () => {
		const excluded = tapFolder(trip, '/Trip/Raw')

		expect(excluded).toEqual({ ...trip, excluded: ['/Trip/Raw'] })
		expect(tapFolder(excluded, '/Trip/Raw')).toEqual(trip)
	})

	// spec: LISTING-003.21
	it('ticks a folder inside an excluded one, and keeps the excluded ones sorted', () => {
		const set = { ...trip, excluded: ['/Trip/Raw'] }

		expect(tapFolder(set, '/Trip/Raw/Best')).toEqual({ ...set, paths: ['/Trip', '/Trip/Raw/Best'] })
		expect(tapFolder(set, '/Trip/Day 1')).toEqual({ ...set, excluded: ['/Trip/Day 1', '/Trip/Raw'] })
	})

	// spec: LISTING-003.22
	it('drops the excluded folders with no ticked folder above when a folder is unticked', () => {
		const set = { paths: ['/Trip', '/Trip/Raw/Best', '/Zoo'], subfolders: true, excluded: ['/Trip/Raw', '/Trip/Raw/Best/Old', '/Zoo/Raw'] }

		expect(tapFolder(set, '/Trip')).toEqual({ paths: ['/Trip/Raw/Best', '/Zoo'], subfolders: true, excluded: ['/Trip/Raw/Best/Old', '/Zoo/Raw'] })
		expect(tapFolder({ ...trip, excluded: ['/Trip/Raw'] }, '/Trip')).toEqual({ paths: [], subfolders: true })
	})

	// spec: LISTING-003.22
	it('ticks a folder kept as excluded while the switch is off, and drops it from the excluded ones', () => {
		expect(tapFolder({ paths: ['/Trip'], subfolders: false, excluded: ['/Trip/Raw'] }, '/Trip/Raw')).toEqual({ paths: ['/Trip', '/Trip/Raw'], subfolders: false })
	})
})

describe('folderListings', () => {
	// spec: LISTING-003.21
	it('lists each ticked folder with the excluded folders below it', () => {
		const set = { paths: ['/Trip', '/Trip/Raw/Best', '/Zoo'], subfolders: true, excluded: ['/Trip/Raw', '/Trip/Raw/Best/Old', '/Other/X'] }

		expect(folderListings(set)).toEqual([
			{ path: '/Trip', excluded: ['/Trip/Raw', '/Trip/Raw/Best/Old'] },
			{ path: '/Trip/Raw/Best', excluded: ['/Trip/Raw/Best/Old'] },
			{ path: '/Zoo', excluded: [] },
		])
	})

	// spec: LISTING-003.22
	it('excludes nothing without subfolders', () => {
		expect(folderListings({ paths: ['/Trip'], subfolders: false, excluded: ['/Trip/Raw'] })).toEqual([{ path: '/Trip', excluded: [] }])
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
