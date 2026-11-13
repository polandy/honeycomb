// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'

import { shallowRef } from 'vue'

type Pictures = readonly Picture<ListingEntry>[]

/** The pictures the tag entry is open for, or null while it is closed (TAGS-003.1, .12). */
export function useTagEntryTargets() {
	const targets = shallowRef<Pictures | null>(null)

	/** Opens the entry for the pictures; false when there are none. */
	function open(chosen: Pictures): boolean {
		if (chosen.length === 0) {
			return false
		}
		targets.value = chosen
		return true
	}

	/** Closes the entry. */
	function close() {
		targets.value = null
	}

	return { targets, open, close }
}
