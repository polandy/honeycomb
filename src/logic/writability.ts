// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { splitFolder } from './file-name.ts'
import { pictureMembers } from './pairing.ts'

/** Nextcloud's permission bits a write through needs: change a sidecar and create one (OCP\Constants). */
const PERMISSION_UPDATE = 2
const PERMISSION_CREATE = 4

/** A folder of the listing with the user's permission bits on it (LISTING-001.19). */
export interface FolderAccess {
	readonly path: string
	readonly permissions: number
}

/** What the listings of a folder set say about writing to its folders. */
export interface ListedAccess {
	readonly folders: readonly FolderAccess[]
}

/** A listing that said nothing about its folders: every folder counts as rateable, the server rechecks. */
export const NO_ACCESS: ListedAccess = { folders: [] }

/** Whether a decision on the picture may be written to its sidecars, or why not (XMP-008). */
export type Writability = 'writable' | LockReason

/** Why a step leaves a picture as it is: a read-only folder (XMP-008.3). */
export type LockReason = 'readOnly'

/** A picture a step leaves as it is, and why. */
export interface LockedPicture {
	readonly picture: Picture<ListingEntry>
	readonly reason: LockReason
}

/** A step's pictures: the rateable ones and the locked ones. */
export interface LockSplit {
	readonly writable: readonly Picture<ListingEntry>[]
	readonly locked: readonly LockedPicture[]
}

/** What the writability of a picture is read from. */
export interface WriteContext {
	readonly folders: ReadonlyMap<string, FolderAccess>
}

/** The well-shaped folders of a listing response with their path and permissions; an item of another shape is dropped. */
export function listedFolders(value: unknown): FolderAccess[] {
	return Array.isArray(value) ? value.filter(isFolderAccess).map(({ path, permissions }) => ({ path, permissions })) : []
}

/** Whether the item is a folder with its path and permission bits. */
function isFolderAccess(item: unknown): item is FolderAccess {
	if (typeof item !== 'object' || item === null) {
		return false
	}
	const { path, permissions } = item as Record<string, unknown>
	return typeof path === 'string' && typeof permissions === 'number'
}

/** The folders by path. */
export function folderAccess(folders: readonly FolderAccess[]): ReadonlyMap<string, FolderAccess> {
	return new Map(folders.map((folder) => [folder.path, folder]))
}

/** The picture's writability: read-only unless every member folder grants UPDATE and CREATE (XMP-008.3, .12). */
export function writability(picture: Picture<ListingEntry>, context: WriteContext): Writability {
	const needed = PERMISSION_UPDATE | PERMISSION_CREATE
	const folders = memberFolders(picture).map((path) => context.folders.get(path)).filter((folder) => folder !== undefined)
	if (folders.some((folder) => (folder.permissions & needed) !== needed)) {
		return 'readOnly'
	}
	return 'writable'
}

/** The pictures split into the rateable and the locked ones, each in its order (XMP-008.14). */
export function splitLocks(pictures: readonly Picture<ListingEntry>[], context: WriteContext): LockSplit {
	const reasons = pictures.map((picture) => ({ picture, reason: writability(picture, context) }))
	const writable = reasons.filter(({ reason }) => reason === 'writable').map(({ picture }) => picture)
	const locked = reasons.filter((each): each is LockedPicture => each.reason !== 'writable')
	return { writable, locked }
}

/** The folders of the picture's members, the root as `/`. */
function memberFolders(picture: Picture<ListingEntry>): string[] {
	return pictureMembers(picture).map((member) => splitFolder(member.path).parent || '/')
}
