// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'

import { computed, nextTick, ref } from 'vue'
import { narrowSnapshot, snapshotIndex } from './logic/loupe-pictures.ts'

/** The open loupe's snapshot and shown index, null while the grid shows, what it shows of them, and closing it back to the grid. */
export function useLoupeOpening(reveal: (index: number) => Promise<void> | undefined, passes: (picture: Picture<ListingEntry>) => boolean) {
	const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)
	const shown = computed(() => (loupe.value === null ? null : narrowSnapshot(loupe.value.pictures, loupe.value.index, passes)))

	/** Shows the picture at the index of the shown pictures. */
	function page(index: number) {
		loupe.value!.index = snapshotIndex(loupe.value!.pictures, shown.value!.pictures, index)
	}

	/** Closes the loupe and focuses its last picture in the grid. */
	async function close() {
		const { index } = loupe.value!
		loupe.value = null
		await nextTick()
		await reveal(index)
	}

	return { loupe, shown, page, close }
}
