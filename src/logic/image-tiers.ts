// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The preview tiers of the grid's tiles, smallest first, at core's preview sizes (ADR 0010). */
export const GRID_TIERS = [256, 1024] as const

/** The preview tier of the loupe, core's largest preview (ADR 0010). */
export const LOUPE_TIER = 4096

/** How many grid images load at once; core renders four previews at a time (GRID-001.15). */
export const IMAGE_LOADS_IN_FLIGHT = 6

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

/** The URL of a tier of the member. */
export function tierSource(member: ListingEntry, tier: number, urlFor: ImageUrlFor): string {
	return urlFor(member.fileId, tier, member.mtime)
}

/** The URL of the smallest grid tier, which a tile loads first. */
export function smallSource(member: ListingEntry, urlFor: ImageUrlFor): string {
	return tierSource(member, GRID_TIERS[0], urlFor)
}

/** The queue priority of a tile's load: visible tiles first, each small tier before its sharp one. */
export function loadPriority(visible: boolean, sharp: boolean): number {
	return (visible ? 0 : 2) + (sharp ? 1 : 0)
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
