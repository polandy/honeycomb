// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Settings } from './logic/settings.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { ListedAccess, LockedPicture, WriteContext, WriteLock } from './logic/writability.ts'

import { computed, shallowRef } from 'vue'
import { memberIds } from './logic/pairing.ts'
import { confirmationFolders, folderAccess, NO_ACCESS, splitLocks, unconfirmedShared, writability } from './logic/writability.ts'
import { XMP_REFUSALS } from './logic/xmp/model.ts'

/** Whether the open cull may write each picture's sidecars, and the gate a step passes before it decides (XMP-008); `legacy` names a picture with legacy rows (XMP-008.11). */
export function useCullAccess<T>(settings: () => Settings, onLocked: (lock: WriteLock<T>) => void, legacy: (picture: Picture<ListingEntry>) => boolean) {
	const access = shallowRef<ListedAccess>(NO_ACCESS)
	const folders = computed(() => folderAccess(access.value.folders))
	const refusedIds = shallowRef<ReadonlySet<number>>(new Set())
	// the pictures the latest step left locked, until its toast takes them
	let skipped: readonly LockedPicture[] = []
	const sharedFolders = computed<ReadonlySet<string>>(() => new Set(access.value.folders.filter((folder) => folder.shared).map((folder) => folder.path)))
	const context = (): WriteContext => ({
		setting: settings().sidecarWrite,
		folders: folders.value,
		opened: access.value.opened,
		confirmed: settings().confirmedSharedFolders,
		refused: (picture) => memberIds(picture).some((fileId) => refusedIds.value.has(fileId)),
		legacy,
	})

	/** Whether a decision on the picture is written to its sidecars, or why not. */
	const writabilityOf = (picture: Picture<ListingEntry>) => writability(picture, context())

	/** Whether the picture lies in a shared folder not confirmed (XMP-007.13). */
	const unconfirmedOf = (picture: Picture<ListingEntry>) => unconfirmedShared(picture, context())

	/** The opened folders that confirm the pictures' shared folders not confirmed (XMP-008.4). */
	const confirmationFoldersOf = (pictures: readonly Picture<ListingEntry>[]) => confirmationFolders(pictures, context())

	/** Takes the access of newly opened folders; refusals were for the folders closed. */
	function open(listed: ListedAccess) {
		access.value = listed
		refusedIds.value = new Set()
	}

	/** Locks the pictures whose sidecar was refused, for the rest of this visit (XMP-008.6). */
	function refuse(failures: readonly SidecarFailure[]) {
		const refusals: readonly string[] = XMP_REFUSALS
		const ids = failures.filter((failure) => refusals.includes(failure.reason)).flatMap((failure) => memberIds(failure.picture))
		if (ids.length > 0) {
			refusedIds.value = new Set([...refusedIds.value, ...ids])
		}
	}

	/** Asks to lift an `off` or `shared` lock first; then takes the step on the writable pictures and keeps the locked ones for its toast (XMP-008.7, .9). `required` locked takes nothing. */
	function gate<S extends T>(chosen: readonly Picture<ListingEntry>[], step: (writable: readonly Picture<ListingEntry>[]) => S | null, required?: Picture<ListingEntry>): S | null {
		const now = context()
		const split = splitLocks(chosen, now)
		skipped = []
		if (split.liftable !== null) {
			onLocked({ reason: split.liftable, folders: confirmationFolders(chosen, now), retry: () => gate(chosen, step, required) })
			return null
		}
		const requiredLock = split.locked.find(({ picture }) => picture === required)
		skipped = requiredLock === undefined ? split.locked : [requiredLock]
		return requiredLock === undefined && split.writable.length > 0 ? step(split.writable) : null
	}

	/** The pictures the latest step left locked, once. */
	function takeSkipped(): readonly LockedPicture[] {
		const taken = skipped
		skipped = []
		return taken
	}

	return { sharedFolders, writabilityOf, unconfirmedOf, confirmationFoldersOf, open, refuse, gate, takeSkipped }
}
