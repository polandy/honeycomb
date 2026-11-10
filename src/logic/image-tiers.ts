// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The preview tiers of the grid's tiles, smallest first (ADR 0010). */
export const GRID_TIERS = [256, 512] as const

/** The preview tier of the loupe (ADR 0010). */
export const LOUPE_TIER = 2048

/** One of the grid's preview tiers. */
export type GridTier = typeof GRID_TIERS[number]

/** The URL of a preview tier of a file, immutable while `mtime` is current (ADR 0010). */
export type ImageUrlFor = (fileId: number, size: number, mtime: number) => string

/** The member whose image a picture shows: the rendered one, else the RAW one (ADR 0010). */
export function imageMember(picture: Picture<ListingEntry>): ListingEntry {
	return picture.rendered ?? picture.raw
}

/** The `srcset` of a tile with every grid tier. */
export function gridSrcset(member: ListingEntry, urlFor: ImageUrlFor): string {
	return GRID_TIERS.map((tier) => `${urlFor(member.fileId, tier, member.mtime)} ${tier}w`).join(', ')
}

/** The URL of the smallest grid tier, which a tile loads first. */
export function smallSource(member: ListingEntry, urlFor: ImageUrlFor): string {
	return urlFor(member.fileId, GRID_TIERS[0], member.mtime)
}

/** The smallest grid tier at least as large as the tile's device pixels, else the largest. */
export function sharpTier(tileCssPx: number, devicePixelRatio: number): GridTier {
	const pixels = tileCssPx * devicePixelRatio
	return GRID_TIERS.find((tier) => tier >= pixels) ?? GRID_TIERS.at(-1)!
}
