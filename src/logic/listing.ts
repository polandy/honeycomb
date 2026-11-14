// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** One file of the listing endpoint (ADR 0009); times are Unix seconds. */
export interface ListingEntry {
	readonly fileId: number
	readonly path: string
	readonly size: number
	readonly mtime: number
	readonly etag: string
	readonly mime: string
	readonly captureTime: number | null
	readonly orientation: number | null
	readonly width: number | null
	readonly height: number | null
	readonly camera: string | null
	/** The stored visual hash of this file version, `null` while none is stored (ADR 0024). */
	readonly visualHash: string | null
}

/** The listings of a folder set as one, each file once, in the order first listed. */
export function mergeListings(listings: readonly (readonly ListingEntry[])[]): ListingEntry[] {
	const merged = new Map<number, ListingEntry>()
	for (const entry of listings.flat()) {
		if (!merged.has(entry.fileId)) {
			merged.set(entry.fileId, entry)
		}
	}
	return [...merged.values()]
}
