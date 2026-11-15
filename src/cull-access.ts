// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Settings } from './logic/settings.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { ListedAccess, WriteContext, WriteLock } from './logic/writability.ts'

import { computed, shallowRef } from 'vue'
import { memberIds } from './logic/pairing.ts'
import { confirmationFolders, folderAccess, lockReason, NO_ACCESS, writability } from './logic/writability.ts'
import { XMP_REFUSALS } from './logic/xmp/model.ts'

/** Whether the open cull may write each picture's sidecars, and the gate a step passes before it decides (XMP-008). */
export function useCullAccess<T>(settings: () => Settings, onLocked: (lock: WriteLock<T>) => void) {
	const access = shallowRef<ListedAccess>(NO_ACCESS)
	const folders = computed(() => folderAccess(access.value.folders))
	const refusedIds = shallowRef<ReadonlySet<number>>(new Set())
	const sharedFolders = computed<ReadonlySet<string>>(() => new Set(access.value.folders.filter((folder) => folder.shared).map((folder) => folder.path)))
	const context = (): WriteContext => ({
		setting: settings().sidecarWrite,
		folders: folders.value,
		opened: access.value.opened,
		confirmed: settings().confirmedSharedFolders,
		refused: (picture) => memberIds(picture).some((fileId) => refusedIds.value.has(fileId)),
	})

	/** Whether a decision on the picture is written to its sidecars, or why not. */
	const writabilityOf = (picture: Picture<ListingEntry>) => writability(picture, context())

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

	/** Takes the step when every chosen picture is writable; otherwise reports the lock and takes nothing (XMP-008.7). */
	function gate<S extends T>(chosen: readonly Picture<ListingEntry>[], step: () => S | null): S | null {
		const now = context()
		const reason = lockReason(chosen, now)
		if (reason === null) {
			return step()
		}
		onLocked({ reason, folders: confirmationFolders(chosen, now), retry: () => gate(chosen, step) })
		return null
	}

	return { sharedFolders, writabilityOf, open, refuse, gate }
}
