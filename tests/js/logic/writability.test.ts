// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { FolderAccess, WriteContext } from '../../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { confirmationFolders, firstLock, folderAccess, splitLocks, unconfirmedShared, writability } from '../../../src/logic/writability.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

const ALL = 31
const READ = 1
const SPLIT: Picture<ListingEntry> = { raw: listingEntry(1, '/P/RAW/A.NEF'), rendered: listingEntry(2, '/P/A.JPG'), folder: '/P', baseName: 'A', sidecars: [], ambiguous: false }
const AT_ROOT = pictureOf(listingEntry(3, '/B.JPG'))

/** A folder of the listing, plain and writable unless the test says otherwise. */
function folder(path: string, access: Partial<FolderAccess> = {}): FolderAccess {
	return { path, shared: false, permissions: ALL, versions: true, ...access }
}

/** A context with writing on, the folders given and `/P` opened as file id 7. */
function context(folders: FolderAccess[], change: Partial<WriteContext> = {}): WriteContext {
	return { setting: 'on', folders: folderAccess(folders), opened: [{ path: '/P', fileId: 7 }], confirmed: [], refused: () => false, legacy: () => false, ...change }
}

describe('writability', () => {
	// spec: XMP-008.1
	it('is writable when every member folder may be written, keeps versions and is not shared', () => {
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW')]))).toBe('writable')
	})

	// spec: XMP-008.2
	it('is off while the setting is off, before any other reason', () => {
		expect(writability(SPLIT, context([folder('/P', { permissions: READ, shared: true, versions: false })], { setting: 'off' }))).toBe('off')
	})

	// spec: XMP-008.3
	it('is read-only when a member folder lacks update or create', () => {
		const shared = { shared: true, versions: false }
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW', { permissions: READ | 4, ...shared })]))).toBe('readOnly')
		expect(writability(SPLIT, context([folder('/P', { permissions: READ | 2 }), folder('/P/RAW')]))).toBe('readOnly')
		expect(writability(SPLIT, context([folder('/P', { permissions: READ | 2 | 4 }), folder('/P/RAW')]))).toBe('writable')
	})

	// spec: XMP-008.4
	it('is shared while a shared member folder is not confirmed, then writable', () => {
		const folders = [folder('/P'), folder('/P/RAW', { shared: true, versions: false })]
		expect(writability(SPLIT, context(folders))).toBe('shared')
		expect(writability(SPLIT, context(folders, { confirmed: [7] }))).toBe('noVersions')
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW', { shared: true })], { confirmed: [7] }))).toBe('writable')
		expect(writability(SPLIT, context([folder('/P'), folder('/P/RAW', { shared: true })], { confirmed: [8] }))).toBe('shared')
	})

	// spec: XMP-008.5
	it('is without versions when a member folder keeps none, before a refused sidecar', () => {
		expect(writability(SPLIT, context([folder('/P', { versions: false })], { refused: () => true }))).toBe('noVersions')
	})

	// spec: XMP-008.6
	it('is refused when a sidecar of the picture was refused', () => {
		expect(writability(SPLIT, context([], { refused: (picture) => picture === SPLIT }))).toBe('refused')
	})

	// spec: XMP-008.11
	it('is legacy while the picture has legacy rows, after every other reason', () => {
		expect(writability(SPLIT, context([], { legacy: (picture) => picture === SPLIT }))).toBe('legacy')
		expect(writability(SPLIT, context([], { legacy: () => true, refused: () => true }))).toBe('refused')
		expect(writability(AT_ROOT, context([], { legacy: (picture) => picture === SPLIT }))).toBe('writable')
	})

	// spec: XMP-008.1
	it('reads the root folder as `/` and takes a folder the listing did not name as writable', () => {
		expect(writability(AT_ROOT, context([folder('/', { permissions: READ })]))).toBe('readOnly')
		expect(writability(AT_ROOT, context([]))).toBe('writable')
	})
})

describe('splitLocks', () => {
	const OTHER = pictureOf(listingEntry(4, '/Q/C.JPG'))

	// spec: XMP-008.7
	it('names a lock the user can lift first, off before shared, whatever else locks the pictures', () => {
		const shared = [folder('/', { permissions: READ }), folder('/Q', { shared: true })]
		expect(splitLocks([AT_ROOT, OTHER], context(shared)).liftable).toBe('shared')
		expect(splitLocks([AT_ROOT, OTHER], context(shared, { setting: 'off' })).liftable).toBe('off')
		expect(splitLocks([AT_ROOT, OTHER], context([folder('/', { permissions: READ })])).liftable).toBeNull()
	})

	// spec: XMP-008.9
	it('splits the pictures into the writable ones and the locked ones with their reasons, in their order', () => {
		const refused = (picture: Picture<ListingEntry>) => picture === OTHER
		const split = splitLocks([SPLIT, AT_ROOT, OTHER], context([folder('/', { permissions: READ })], { refused }))

		expect(split.writable).toEqual([SPLIT])
		expect(split.locked).toEqual([{ picture: AT_ROOT, reason: 'readOnly' }, { picture: OTHER, reason: 'refused' }])
		expect(splitLocks([SPLIT], context([]))).toEqual({ liftable: null, writable: [SPLIT], locked: [] })
	})
})

describe('firstLock', () => {
	// spec: XMP-008.9
	it('names the first reason in the order of the reasons, not of the pictures', () => {
		expect(firstLock([{ picture: SPLIT, reason: 'refused' }, { picture: AT_ROOT, reason: 'noVersions' }])).toBe('noVersions')
		expect(firstLock([{ picture: SPLIT, reason: 'noVersions' }, { picture: AT_ROOT, reason: 'readOnly' }])).toBe('readOnly')
		expect(firstLock([{ picture: SPLIT, reason: 'refused' }])).toBe('refused')
		expect(firstLock([{ picture: SPLIT, reason: 'legacy' }, { picture: AT_ROOT, reason: 'refused' }])).toBe('refused')
		expect(firstLock([{ picture: SPLIT, reason: 'legacy' }])).toBe('legacy')
	})
})

describe('confirmationFolders', () => {
	// spec: XMP-008.4
	it('names the nearest opened folder of each unconfirmed shared member folder once', () => {
		const opened = [{ path: '/', fileId: 1 }, { path: '/P', fileId: 7 }, { path: '/Q', fileId: 9 }]
		const other = pictureOf(listingEntry(4, '/Q/C.JPG'))
		const shared = context([folder('/P/RAW', { shared: true }), folder('/Q', { shared: true }), folder('/', { shared: true })], { opened })

		expect(confirmationFolders([SPLIT, other, SPLIT], shared)).toEqual([{ path: '/P', fileId: 7 }, { path: '/Q', fileId: 9 }])
		expect(confirmationFolders([AT_ROOT], shared)).toEqual([{ path: '/', fileId: 1 }])
		expect(confirmationFolders([SPLIT, other], { ...shared, confirmed: [7, 9] })).toEqual([])
		expect(confirmationFolders([SPLIT], context([folder('/P/RAW', { shared: true })], { opened: [] }))).toEqual([])
	})
})

describe('unconfirmedShared', () => {
	// spec: XMP-007.13
	it('is true while a shared member folder is not confirmed, whatever else locks the picture', () => {
		const shared = [folder('/P'), folder('/P/RAW', { shared: true, versions: false })]
		expect(unconfirmedShared(SPLIT, context(shared, { setting: 'off' }))).toBe(true)
		expect(unconfirmedShared(SPLIT, context(shared, { confirmed: [7] }))).toBe(false)
		expect(unconfirmedShared(SPLIT, context([folder('/P'), folder('/P/RAW')]))).toBe(false)
		expect(unconfirmedShared(AT_ROOT, context([]))).toBe(false)
	})
})
