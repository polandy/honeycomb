// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { addLibraryRoot, isInsideRoots, normalizeRoot, removeLibraryRoot, validateLibraryRoots } from '../../../src/logic/library-roots.ts'

describe('normalizeRoot', () => {
	// spec: FOLDERS-004.1
	it('trims, collapses slashes and adds the leading slash', () => {
		expect(normalizeRoot(' Photos//2019/ ')).toBe('/Photos/2019')
		expect(normalizeRoot('/Photos')).toBe('/Photos')
	})
})

describe('addLibraryRoot', () => {
	// spec: FOLDERS-004.1, FOLDERS-004.6
	it('adds the normalised root at the end', () => {
		expect(addLibraryRoot(['/Archive'], ' Photos//2019/ ')).toEqual({ roots: ['/Archive', '/Photos/2019'] })
	})

	// spec: FOLDERS-004.2
	it('refuses a blank input and the home folder as empty', () => {
		expect(addLibraryRoot([], '  ')).toEqual({ refused: { reason: 'empty', path: '' } })
		expect(addLibraryRoot([], '/')).toEqual({ refused: { reason: 'empty', path: '' } })
	})

	// spec: FOLDERS-004.3
	it('refuses dot segments and backslashes as invalid', () => {
		for (const input of ['/Photos/../Docs', '/a/./b', '/a\\b', '..']) {
			expect(addLibraryRoot([], input)).toMatchObject({ refused: { reason: 'invalid' } })
		}
	})

	// spec: FOLDERS-004.4
	it('refuses a duplicate naming the listed root', () => {
		expect(addLibraryRoot(['/Photos'], '/Photos/')).toEqual({ refused: { reason: 'duplicate', path: '/Photos', other: '/Photos' } })
	})

	// spec: FOLDERS-004.5
	it('refuses a root inside or around another, but not a sibling with the same prefix', () => {
		expect(addLibraryRoot(['/Photos'], '/Photos/2019')).toEqual({ refused: { reason: 'inside', path: '/Photos/2019', other: '/Photos' } })
		expect(addLibraryRoot(['/Photos/2019'], '/Photos')).toEqual({ refused: { reason: 'contains', path: '/Photos', other: '/Photos/2019' } })
		expect(addLibraryRoot(['/Photos'], '/Photos2')).toEqual({ roots: ['/Photos', '/Photos2'] })
	})
})

describe('removeLibraryRoot', () => {
	// spec: FOLDERS-004.6
	it('removes a listed root, also the last one', () => {
		expect(removeLibraryRoot(['/a', '/b'], '/a')).toEqual(['/b'])
		expect(removeLibraryRoot(['/a'], '/a')).toEqual([])
		expect(removeLibraryRoot(['/a'], '/x')).toEqual(['/a'])
	})
})

describe('validateLibraryRoots', () => {
	// spec: FOLDERS-004.7
	it('accepts a valid list and an empty one', () => {
		expect(validateLibraryRoots(['/Photos', '/Archive'])).toBeNull()
		expect(validateLibraryRoots([])).toBeNull()
	})

	// spec: FOLDERS-004.7
	it('returns the first refusal with its path', () => {
		expect(validateLibraryRoots(['/Photos', '/Photos/2019', '/Photos'])).toEqual({ reason: 'inside', path: '/Photos/2019', other: '/Photos' })
		expect(validateLibraryRoots(['/a', ''])).toEqual({ reason: 'empty', path: '' })
		expect(validateLibraryRoots(['/a', 'b'])).toBeNull()
	})
})

describe('isInsideRoots', () => {
	// spec: SETTINGS-001.36
	it('takes a root and every folder below one, and no sibling that shares a prefix', () => {
		const roots = ['/Photos', '/Archive/2020']

		expect(isInsideRoots(roots, '/Photos')).toBe(true)
		expect(isInsideRoots(roots, '/Photos/Italy/Rome')).toBe(true)
		expect(isInsideRoots(roots, '/Archive/2020/May')).toBe(true)
		expect(isInsideRoots(roots, '/Photos2')).toBe(false)
		expect(isInsideRoots(roots, '/Archive')).toBe(false)
		expect(isInsideRoots(roots, '/')).toBe(false)
		expect(isInsideRoots(roots, '/Photos/../Docs')).toBe(false)
	})

	// spec: SETTINGS-001.36
	it('takes every folder while no root is set', () => {
		expect(isInsideRoots([], '/Anything')).toBe(true)
		expect(isInsideRoots([], '/')).toBe(true)
	})
})
