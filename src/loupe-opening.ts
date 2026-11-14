// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { CompareLanding } from './series-compare.ts'

import { computed, nextTick, shallowRef } from 'vue'
import { firstAfter, narrowSnapshot, snapshotIndex } from './logic/loupe-pictures.ts'

/** The open loupe's snapshot of the cull's own pictures, not reactive proxies, and shown index, null while the grid shows, what it shows of them, and closing it back to the grid. */
export function useLoupeOpening(reveal: (index: number) => Promise<void> | undefined, passes: (picture: Picture<ListingEntry>) => boolean) {
	const loupe = shallowRef<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)
	const shown = computed(() => (loupe.value === null ? null : narrowSnapshot(loupe.value.pictures, loupe.value.index, passes)))

	/** Shows the picture at the index of the shown pictures. */
	function page(index: number) {
		loupe.value = { ...loupe.value!, index: snapshotIndex(loupe.value!.pictures, shown.value!.pictures, index) }
	}

	/** Shows where a compare opened from the loupe lands, if the loupe still shows it (SERIES-001.24). */
	function land(landing: CompareLanding<Picture<ListingEntry>>) {
		if (shown.value === null) {
			return
		}
		const target = landing.kind === 'on' ? landing.picture : firstAfter(loupe.value!.pictures, shown.value.pictures, landing.series) ?? landing.picked
		const at = shown.value.pictures.indexOf(target)
		if (at >= 0) {
			page(at)
		}
	}

	/** Closes the loupe and focuses its last picture in the grid. */
	async function close() {
		const { index } = loupe.value!
		loupe.value = null
		await nextTick()
		await reveal(index)
	}

	return { loupe, shown, page, land, close }
}
