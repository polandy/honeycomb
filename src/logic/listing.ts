// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagFields } from './picture-flag.ts'
import type { PictureId } from './picture-id.ts'
import type { QualityValue } from './sharpness.ts'

/** What every picture source lists of one file: identity, pairing, sorting, display and flags (ADR 0041); times are Unix seconds. */
export interface SourceEntry extends FlagFields {
	readonly fileId: PictureId
	readonly path: string
	readonly mtime: number
	readonly mime: string
	readonly captureTime: number | null
	readonly orientation: number | null
	readonly width: number | null
	readonly height: number | null
	readonly camera: string | null
}

/** One file of the listing endpoint (ADR 0009) with its flag row (LISTING-001.18). */
export interface ListingEntry extends SourceEntry {
	readonly size: number
	readonly etag: string
	/** The stored visual hash of this file version, `null` while none is stored (ADR 0024). */
	readonly visualHash: string | null
	/** The stored quality value of this file version, `null` while none is stored (ADR 0046). */
	readonly quality: QualityValue | null
}

/** The listings of a folder set as one, each file once, in the order first listed. */
export function mergeListings(listings: readonly (readonly ListingEntry[])[]): ListingEntry[] {
	const merged = new Map<PictureId, ListingEntry>()
	for (const entry of listings.flat()) {
		if (!merged.has(entry.fileId)) {
			merged.set(entry.fileId, entry)
		}
	}
	return [...merged.values()]
}
