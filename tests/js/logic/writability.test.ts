// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { FolderAccess, WriteContext } from '../../../src/logic/writability.ts'

import { describe, expect, it } from 'vitest'
import { confirmationFolders, folderAccess, lockReason, writability } from '../../../src/logic/writability.ts'
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
	return { setting: 'on', folders: folderAccess(folders), opened: [{ path: '/P', fileId: 7 }], confirmed: [], refused: () => false, ...change }
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

	// spec: XMP-008.1
	it('reads the root folder as `/` and takes a folder the listing did not name as writable', () => {
		expect(writability(AT_ROOT, context([folder('/', { permissions: READ })]))).toBe('readOnly')
		expect(writability(AT_ROOT, context([]))).toBe('writable')
	})
})

describe('lockReason', () => {
	// spec: XMP-008.7
	it('names the first reason in the order of the reasons, not of the pictures, and null when all are writable', () => {
		const folders = [folder('/P', { versions: false }), folder('/', { permissions: READ })]
		expect(lockReason([SPLIT, AT_ROOT], context(folders))).toBe('readOnly')
		expect(lockReason([SPLIT], context(folders))).toBe('noVersions')
		expect(lockReason([AT_ROOT], context([]))).toBeNull()
	})

	// spec: XMP-008.7
	it('names a refused picture last, after a picture locked for any other reason', () => {
		const refused = (picture: Picture<ListingEntry>) => picture === SPLIT
		expect(lockReason([SPLIT, AT_ROOT], context([folder('/', { versions: false })], { refused }))).toBe('noVersions')
		expect(lockReason([SPLIT, AT_ROOT], context([folder('/', { permissions: READ })], { refused }))).toBe('readOnly')
		expect(lockReason([SPLIT, AT_ROOT], context([], { setting: 'off', refused }))).toBe('off')
		expect(lockReason([SPLIT, AT_ROOT], context([], { refused }))).toBe('refused')
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
