// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'
import type { FolderSetCount, Listing } from './logic/cull.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { PairingSettings } from './logic/pairing.ts'

import { ref, watch } from 'vue'
import { logger } from './logger.ts'
import { countFolderSet } from './logic/cull.ts'
import { folderListings } from './logic/folder-set.ts'

/** Lists one folder, with every folder below it but the `excluded` ones when `subfolders`. */
export type ListEntries = (path: string, subfolders: boolean, excluded?: readonly string[]) => Promise<Listing>

/** The listings of every ticked folder of `set`, each without the excluded folders below it. */
export function listFolderSet(set: FolderSet, listEntries: ListEntries): Promise<Listing[]> {
	return Promise.all(folderListings(set).map(({ path, excluded }) => listEntries(path, set.subfolders, excluded)))
}

/**
 * The count of the folder set `set` holds as `pairing` pairs it, kept current as either changes.
 * Each folder is listed once per switch position and exclusions; a failed listing is asked again next time.
 */
export function useFolderCount(set: Ref<FolderSet>, listEntries: ListEntries, pairing: () => PairingSettings) {
	const cache = new Map<string, Promise<Listing>>()
	const count = ref<FolderSetCount | null>(null)
	const failed = ref(false)

	const listing: ListEntries = (path, subfolders, excluded = []) => {
		const key = JSON.stringify([path, subfolders, excluded])
		let answer = cache.get(key)
		if (answer === undefined) {
			answer = listEntries(path, subfolders, excluded)
			answer.catch(() => cache.delete(key))
			cache.set(key, answer)
		}
		return answer
	}

	let latestCount = 0
	watch([set, pairing], async ([folderSet, settings]) => {
		const { paths, subfolders } = folderSet
		const counting = ++latestCount
		count.value = null
		failed.value = false
		if (paths.length === 0) {
			return
		}
		try {
			const listings = await listFolderSet(folderSet, listing)
			if (counting === latestCount) {
				count.value = countFolderSet(listings, settings)
			}
		} catch (error) {
			if (counting === latestCount) {
				logger.error('Could not count the photos', { subfolders, error })
				failed.value = true
			}
		}
	}, { immediate: true })

	return { count, failed }
}
