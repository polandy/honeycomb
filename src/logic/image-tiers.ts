// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The preview tiers of the grid's tiles, smallest first (ADR 0010). */
export const GRID_TIERS = [256, 512] as const

/** The preview tier of the loupe (ADR 0010). */
export const LOUPE_TIER = 2048

/** The tier of the full image, the loupe's 100 % zoom (ADR 0010). */
const FULL_TIER = 0

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

/** The loupe's sources of a member: the grid's large tier at once, the loupe tier, the full image. */
export function loupeSources(member: ListingEntry, urlFor: ImageUrlFor) {
	return {
		preview: urlFor(member.fileId, GRID_TIERS.at(-1)!, member.mtime),
		loupe: urlFor(member.fileId, LOUPE_TIER, member.mtime),
		full: urlFor(member.fileId, FULL_TIER, member.mtime),
	}
}

/** The long edge of the full image in pixels, from the listing, else the loupe tier's. */
export function fullLongEdge(member: ListingEntry): number {
	return member.width !== null && member.height !== null ? Math.max(member.width, member.height) : LOUPE_TIER
}
