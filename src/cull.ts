// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'

import { computed, ref, shallowRef } from 'vue'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmFileIds } from './logic/cull.ts'
import { parseTileSize } from './logic/tile-size.ts'

/** The browser storage key of the thumbnail size. */
export const TILE_SIZE_KEY = 'honeycomb.tileSize'

/** The browser's storage; reaching it throws where site data is blocked. */
export type BrowserStorage = () => Pick<Storage, 'getItem' | 'setItem'>

/** The open cull, its view settings and the folder picker's state. */
export function useCull(warmPreviews: (fileIds: readonly number[]) => Promise<void>, storage: BrowserStorage) {
	const folderSet = ref<FolderSet | null>(null)
	const pictures = shallowRef<Picture<ListingEntry>[]>([])
	const pickerOpen = ref(true)
	const groupByFolder = ref(false)
	const tileSize = ref(parseTileSize(readStored(storage)))
	const folders = computed(() => new Set(pictures.value.map((picture) => picture.folder)).size)

	/** Shows the pictures of the confirmed folders and warms their previews in the grid's order. */
	function open(set: FolderSet, entries: readonly ListingEntry[]) {
		folderSet.value = set
		pictures.value = prepareCull(entries, nameComparer()).pictures
		pickerOpen.value = false
		warmPreviews(warmFileIds(pictures.value)).catch((error: unknown) => logger.error('Could not warm the previews', { error }))
	}

	/** Sets the thumbnail size and keeps it for the next visit. */
	function setTileSize(size: number) {
		tileSize.value = size
		try {
			storage().setItem(TILE_SIZE_KEY, String(size))
		} catch {
			// Without site data the size lasts for this visit only.
		}
	}

	return { folderSet, pictures, folders, pickerOpen, groupByFolder, tileSize, open, setTileSize }
}

/** The stored thumbnail size, or null when there is none or no storage. */
function readStored(storage: BrowserStorage): string | null {
	try {
		return storage().getItem(TILE_SIZE_KEY)
	} catch {
		return null
	}
}
