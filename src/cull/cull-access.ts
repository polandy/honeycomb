// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry, SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { ListedAccess, LockedPicture, WriteContext } from '../logic/writability.ts'

import { computed, shallowRef } from 'vue'
import { folderAccess, NO_ACCESS, splitLocks, writability } from '../logic/writability.ts'

/** Whether the open cull may write each picture's sidecars, and the gate a step passes before it decides (XMP-008). */
export function useCullAccess() {
	const access = shallowRef<ListedAccess>(NO_ACCESS)
	const folders = computed(() => folderAccess(access.value.folders))
	// the pictures the latest step left locked, until its toast takes them
	let skipped: readonly LockedPicture[] = []
	const context = (): WriteContext => ({ folders: folders.value })

	/** Whether a decision on the picture is written to its sidecars, or why not. */
	const writabilityOf = (picture: Picture<SourceEntry>) => writability(picture, context())

	/** Takes the access of newly opened folders. */
	function open(listed: ListedAccess) {
		access.value = listed
	}

	/** Takes the step on the rateable pictures and keeps the locked ones for its toast (XMP-008.14). `required` locked takes nothing. */
	function gate<S>(chosen: readonly Picture<ListingEntry>[], step: (writable: readonly Picture<ListingEntry>[]) => S | null, required?: Picture<ListingEntry>): S | null {
		const split = splitLocks(chosen, context())
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

	return { writabilityOf, open, gate, takeSkipped }
}
