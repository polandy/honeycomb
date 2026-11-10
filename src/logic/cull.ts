// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './folder-set.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { splitFolder } from './file-name.ts'
import { summarise } from './folder-set.ts'
import { imageMember } from './image-tiers.ts'
import { mergeListings } from './listing.ts'
import { DEFAULT_PAIRING_SETTINGS, pairPictures } from './pairing.ts'
import { capPictures, orderForGrid, PICTURE_CAP } from './picture-order.ts'

/** One folder's listing as the listing endpoint returns it (ADR 0009). */
export interface Listing {
	readonly entries: readonly ListingEntry[]
	readonly truncated: boolean
}

/** What the picker reports for the ticked folders; `overCap` when the grid will not show them all. */
export interface FolderSetCount {
	readonly entries: ListingEntry[]
	readonly pictures: number
	readonly folders: number
	readonly firstFolder: string | null
	readonly overCap: boolean
}

/** The merged entries of the listings and how many pictures in how many folders they make. */
export function countFolderSet(listings: readonly Listing[]): FolderSetCount {
	const entries = mergeListings(listings.map((listing) => listing.entries))
	const pictures = pairPictures(entries, DEFAULT_PAIRING_SETTINGS)
	const { folders } = summarise(pictures)
	const overCap = pictures.length > PICTURE_CAP || listings.some((listing) => listing.truncated)
	return { entries, pictures: pictures.length, folders, firstFolder: pictures[0]?.folder ?? null, overCap }
}

/** A folder's name in the grid: relative to the one folder picked with its subfolders, else its own name. */
export function folderLabel(folder: string, set: FolderSet): string {
	const root = set.paths.length === 1 && set.subfolders ? set.paths[0]! : null
	return root !== null && folder.startsWith(`${root}/`) ? folder.slice(root.length + 1) : splitFolder(folder).name
}

/** The pictures of a cull: paired, capped and in the grid's order; `cut` when some were left out. */
export function prepareCull(entries: readonly ListingEntry[], compareNames: (a: string, b: string) => number): { pictures: Picture<ListingEntry>[], cut: boolean } {
	const { pictures, cut } = capPictures(pairPictures(entries, DEFAULT_PAIRING_SETTINGS))
	return { pictures: orderForGrid(pictures, compareNames), cut }
}

/** The file ids whose previews to warm, in the pictures' order. */
export function warmFileIds(pictures: readonly Picture<ListingEntry>[]): number[] {
	return pictures.map((picture) => imageMember(picture).fileId)
}
