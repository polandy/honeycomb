// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'

import { nextTick, ref } from 'vue'

/** The open loupe's pictures and shown index, null while the grid shows, and closing it back to the grid. */
export function useLoupeOpening(reveal: (index: number) => Promise<void> | undefined) {
	const loupe = ref<{ pictures: readonly Picture<ListingEntry>[], index: number } | null>(null)

	/** Closes the loupe and focuses its last picture in the grid. */
	async function close() {
		const { index } = loupe.value!
		loupe.value = null
		await nextTick()
		await reveal(index)
	}

	return { loupe, close }
}
