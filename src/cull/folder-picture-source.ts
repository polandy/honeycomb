// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListEntries } from '../folders/folder-count.ts'
import type { FolderSetCount, Listing } from '../logic/cull.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { PairingSettings } from '../logic/pairing.ts'
import type { PictureSource } from '../logic/picture-source.ts'
import type { FlagAnswer, FlagApi, FlagItem } from './flags-api.ts'

import { listFolderSet } from '../folders/folder-count.ts'
import { countFolderSet } from '../logic/cull.ts'
import { EVERYTHING } from '../logic/opened-source.ts'

/** The types of a cull of Nextcloud folders: one page with every ticked folder's listing, counted client side. */
export interface FolderShape {
	readonly entry: ListingEntry
	readonly page: { readonly listings: readonly Listing[], readonly nextCursor: null }
	readonly listQuery: FolderSet
	readonly countsQuery: { readonly listings: readonly Listing[], readonly pairing: PairingSettings }
	readonly counts: FolderSetCount
	readonly row: FlagItem
	readonly saved: FlagAnswer
}

/** The server calls a folder source is built on. */
export interface FolderPictureApi {
	readonly listEntries: ListEntries
	readonly imageUrl: ImageUrlFor
	readonly saveFlags: FlagApi['save']
}

/** The Nextcloud folders as a picture source: listed in one page, paired and counted in the browser, every capability (ADR 0058). */
export function folderPictureSource(api: FolderPictureApi): PictureSource<FolderShape> {
	return {
		capabilities: EVERYTHING,
		list: async (set) => ({ listings: await listFolderSet(set, api.listEntries), nextCursor: null }),
		counts: async ({ listings, pairing }) => countFolderSet(listings, pairing),
		imageUrl: (entry, size) => api.imageUrl(entry.fileId, size, entry.mtime),
		decide: (rows) => api.saveFlags(rows),
	}
}
