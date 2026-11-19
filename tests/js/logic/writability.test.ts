// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { FolderAccess, WriteContext } from '../../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { firstLock, folderAccess, listedFolders, splitLocks, writability } from '../../../src/logic/writability.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const ALL = 31
const READ = 1
const UPDATE = 2
const CREATE = 4
const SPLIT: Picture<ListingEntry> = { raw: listingEntry(1, '/P/RAW/A.NEF'), rendered: listingEntry(2, '/P/A.JPG'), folder: '/P', baseName: 'A', sidecars: [], ambiguous: false }
const AT_ROOT = pictureOf(listingEntry(3, '/B.JPG'))

/** A folder of the listing with every permission unless the test says otherwise. */
function folder(path: string, permissions = ALL): FolderAccess {
	return { path, permissions }
}

/** A context of the folders given, without legacy rows. */
function context(folders: FolderAccess[], change: Partial<WriteContext> = {}): WriteContext {
	return { folders: folderAccess(folders), legacy: () => false, ...change }
}

describe('writability', () => {
	// spec: XMP-008.12
	it('is writable when every member folder grants update and create', () => {
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW')]))).toBe('writable')
		expect(writability(SPLIT, context([folder('/P', READ | UPDATE | CREATE), folder('/P/RAW', READ | UPDATE | CREATE)]))).toBe('writable')
	})

	// spec: XMP-008.12
	it('reads the root folder as `/` and takes a folder the listing did not name as writable', () => {
		expect(writability(AT_ROOT, context([folder('/', READ)]))).toBe('readOnly')
		expect(writability(AT_ROOT, context([]))).toBe('writable')
		expect(writability(SPLIT, context([folder('/P')]))).toBe('writable')
	})

	// spec: XMP-008.3
	it('is read-only when a member folder lacks update or create, a subfolder by its own ACL too', () => {
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW', READ | UPDATE)]))).toBe('readOnly')
		expect(writability(SPLIT, context([folder('/P', READ | CREATE), folder('/P/RAW')]))).toBe('readOnly')
		expect(writability(SPLIT, context([folder('/P', READ), folder('/P/RAW', READ)]))).toBe('readOnly')
	})

	// spec: XMP-008.11
	it('is legacy while the picture has legacy rows, after read-only', () => {
		expect(writability(SPLIT, context([], { legacy: (picture) => picture === SPLIT }))).toBe('legacy')
		expect(writability(SPLIT, context([folder('/P', READ)], { legacy: () => true }))).toBe('readOnly')
		expect(writability(AT_ROOT, context([], { legacy: (picture) => picture === SPLIT }))).toBe('writable')
	})
})

describe('listedFolders', () => {
	// spec: XMP-008.12
	it('keeps the path and permissions of each folder and drops an item of another shape', () => {
		const folders = [{ path: '/P', permissions: 31 }, { path: '/Q', shared: true }, 'oops', null, { path: 7, permissions: 31 }, { path: '/R', permissions: 1, shared: true, versions: false }]

		expect(listedFolders(folders)).toEqual([{ path: '/P', permissions: 31 }, { path: '/R', permissions: 1 }])
		expect(listedFolders('oops')).toEqual([])
	})
})

describe('splitLocks', () => {
	const OTHER = pictureOf(listingEntry(4, '/Q/C.JPG'))

	// spec: XMP-008.14
	it('splits the pictures into the writable ones and the locked ones with their reasons, in their order', () => {
		const legacy = (picture: Picture<ListingEntry>) => picture === OTHER
		const split = splitLocks([SPLIT, AT_ROOT, OTHER], context([folder('/', READ)], { legacy }))

		expect(split.writable).toEqual([SPLIT])
		expect(split.locked).toEqual([{ picture: AT_ROOT, reason: 'readOnly' }, { picture: OTHER, reason: 'legacy' }])
		expect(splitLocks([SPLIT], context([]))).toEqual({ writable: [SPLIT], locked: [] })
	})
})

describe('firstLock', () => {
	// spec: XMP-008.14
	it('names the first reason in the order of the reasons, not of the pictures', () => {
		expect(firstLock([{ picture: SPLIT, reason: 'legacy' }, { picture: AT_ROOT, reason: 'readOnly' }])).toBe('readOnly')
		expect(firstLock([{ picture: SPLIT, reason: 'legacy' }])).toBe('legacy')
	})
})
