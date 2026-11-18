// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarWrite } from './settings.ts'

import { splitFolder } from './file-name.ts'
import { pictureMembers } from './pairing.ts'

/** Nextcloud's permission bits a write through needs: change a sidecar and create one (OCP\Constants). */
const PERMISSION_UPDATE = 2
const PERMISSION_CREATE = 4

/** A folder of the listing: shared, its permission bits and whether it keeps versions (LISTING-001.12). */
export interface FolderAccess {
	readonly path: string
	readonly shared: boolean
	readonly permissions: number
	readonly versions: boolean
}

/** A folder the user opened, by its file id, which a shared confirmation is kept under (XMP-008.4). */
export interface OpenedFolder {
	readonly path: string
	readonly fileId: number
}

/** What the listings of a folder set say about writing to its folders. */
export interface ListedAccess {
	readonly folders: readonly FolderAccess[]
	readonly opened: readonly OpenedFolder[]
}

/** A listing that said nothing about its folders: every folder counts as writable, the server rechecks. */
export const NO_ACCESS: ListedAccess = { folders: [], opened: [] }

/** Whether a decision on the picture may be written to its sidecars, or the first reason it may not (XMP-008). */
export type Writability = 'writable' | 'off' | 'readOnly' | 'shared' | 'noVersions' | 'refused'

/** A lock the user lifts in the dialog: turn writing On, confirm a shared folder (XMP-008.7). */
export type LiftableLock = 'off' | 'shared'

/** A lock the step leaves its picture to (XMP-008.9). */
export type FixedLock = Exclude<Writability, 'writable' | LiftableLock>

/** The liftable locks, first the one asked first. */
const LIFTABLE_ORDER: readonly LiftableLock[] = ['off', 'shared']

/** The fixed locks, first the one a toast names first (XMP-008.9). */
const FIXED_ORDER: readonly FixedLock[] = ['readOnly', 'noVersions', 'refused']

/** A picture a step leaves as it is, and why. */
export interface LockedPicture {
	readonly picture: Picture<ListingEntry>
	readonly reason: FixedLock
}

/** A step's pictures by lock: the lock to lift first, the writable pictures and the locked ones. */
export interface LockSplit {
	readonly liftable: LiftableLock | null
	readonly writable: readonly Picture<ListingEntry>[]
	readonly locked: readonly LockedPicture[]
}

/** What the writability of a picture is read from. */
export interface WriteContext {
	readonly setting: SidecarWrite
	readonly folders: ReadonlyMap<string, FolderAccess>
	readonly opened: readonly OpenedFolder[]
	readonly confirmed: readonly number[]
	readonly refused: (picture: Picture<ListingEntry>) => boolean
}

/** A step not taken until the user lifts its lock: the reason, the shared folders to confirm, and the step again. */
export interface WriteLock<T = unknown> {
	readonly reason: LiftableLock
	readonly folders: readonly OpenedFolder[]
	readonly retry: () => T | null
}

/** The well-shaped folders of a listing response; an item of another shape is dropped. */
export function listedFolders(value: unknown): FolderAccess[] {
	return Array.isArray(value) ? value.filter(isFolderAccess) : []
}

/** Whether the item is a folder with its path, shared flag, permission bits and versions flag. */
function isFolderAccess(item: unknown): item is FolderAccess {
	if (typeof item !== 'object' || item === null) {
		return false
	}
	const { path, shared, permissions, versions } = item as Record<string, unknown>
	return typeof path === 'string' && typeof shared === 'boolean' && typeof permissions === 'number' && typeof versions === 'boolean'
}

/** The folders by path. */
export function folderAccess(folders: readonly FolderAccess[]): ReadonlyMap<string, FolderAccess> {
	return new Map(folders.map((folder) => [folder.path, folder]))
}

/** The picture's writability: off first, then read-only, shared, without versions, refused (XMP-008.1–.6). */
export function writability(picture: Picture<ListingEntry>, context: WriteContext): Writability {
	if (context.setting === 'off') {
		return 'off'
	}
	const folders = memberFolders(picture).map((path) => context.folders.get(path)).filter((folder) => folder !== undefined)
	const needed = PERMISSION_UPDATE | PERMISSION_CREATE
	if (folders.some((folder) => (folder.permissions & needed) !== needed)) {
		return 'readOnly'
	}
	if (unconfirmedShared(picture, context)) {
		return 'shared'
	}
	if (folders.some((folder) => !folder.versions)) {
		return 'noVersions'
	}
	return context.refused(picture) ? 'refused' : 'writable'
}

/** Whether a member folder of the picture is shared and its opened folder not confirmed (XMP-008.4, XMP-007.13). */
export function unconfirmedShared(picture: Picture<ListingEntry>, context: WriteContext): boolean {
	return memberFolders(picture).some((path) => context.folders.get(path)?.shared === true && !isConfirmed(path, context))
}

/** The pictures by lock, each picture in its order; the liftable lock is the first in the order `off`, `shared` (XMP-008.7, .9). */
export function splitLocks(pictures: readonly Picture<ListingEntry>[], context: WriteContext): LockSplit {
	const reasons = pictures.map((picture) => ({ picture, reason: writability(picture, context) }))
	const writable = reasons.filter(({ reason }) => reason === 'writable').map(({ picture }) => picture)
	const locked = reasons.filter((each): each is LockedPicture => isFixed(each.reason))
	const liftable = LIFTABLE_ORDER.find((reason) => reasons.some((each) => each.reason === reason)) ?? null
	return { liftable, writable, locked }
}

/** Whether the lock is one a step leaves its picture to. */
function isFixed(reason: Writability): reason is FixedLock {
	return (FIXED_ORDER as readonly Writability[]).includes(reason)
}

/** The first reason of the locked pictures in the order `readOnly`, `noVersions`, `refused` (XMP-008.9). */
export function firstLock(locked: readonly LockedPicture[]): FixedLock {
	return locked.reduce<FixedLock>((first, { reason }) => (FIXED_ORDER.indexOf(reason) < FIXED_ORDER.indexOf(first) ? reason : first), 'refused')
}

/** The opened folders that confirm the unconfirmed shared folders of the pictures, each once (XMP-008.4). */
export function confirmationFolders(pictures: readonly Picture<ListingEntry>[], context: WriteContext): OpenedFolder[] {
	const roots = new Map<number, OpenedFolder>()
	for (const path of pictures.flatMap(memberFolders)) {
		const folder = context.folders.get(path)
		const root = coveringFolder(path, context.opened)
		if (folder?.shared === true && root !== undefined && !context.confirmed.includes(root.fileId)) {
			roots.set(root.fileId, root)
		}
	}
	return [...roots.values()]
}

/** The folders of the picture's members, the root as `/`. */
function memberFolders(picture: Picture<ListingEntry>): string[] {
	return pictureMembers(picture).map((member) => splitFolder(member.path).parent || '/')
}

/** Whether the opened folder that holds the shared folder was confirmed. */
function isConfirmed(path: string, context: WriteContext): boolean {
	const root = coveringFolder(path, context.opened)
	return root !== undefined && context.confirmed.includes(root.fileId)
}

/** The nearest opened folder that is the folder or holds it. */
function coveringFolder(path: string, opened: readonly OpenedFolder[]): OpenedFolder | undefined {
	const covering = opened.filter((root) => root.path === '/' || root.path === path || path.startsWith(`${root.path}/`))
	return covering.reduce<OpenedFolder | undefined>((nearest, root) => (nearest === undefined || root.path.length > nearest.path.length ? root : nearest), undefined)
}
