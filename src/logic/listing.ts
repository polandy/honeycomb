// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Picture } from './pairing.ts'
import type { FlagFields } from './picture-flag.ts'
import type { PictureId } from './picture-id.ts'
import type { Series } from './series.ts'
import type { Exposure } from './shake-risk.ts'
import type { QualityValue } from './sharpness.ts'

import { imageMember } from './image-tiers.ts'

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
	/** The EXIF exposure facts, `null` where Nextcloud extracted none (ADR 0046). */
	readonly exposure: Exposure | null
}

/** Whether the picture comes from the listing endpoint, so its members carry the folder-only fields. */
export function isListingPicture(picture: Picture<SourceEntry>): picture is Picture<ListingEntry> {
	return 'etag' in imageMember(picture)
}

/** Thrown when a picture without a listing reaches a folder-only step. */
export class NotListedError extends Error {}

/** The pictures as listing pictures; throws on any other, which a folder-only step never gets. */
export function listedPictures(pictures: readonly Picture<SourceEntry>[]): Picture<ListingEntry>[] {
	if (!pictures.every(isListingPicture)) {
		throw new NotListedError('A picture without a listing reached a folder-only step')
	}
	return [...pictures]
}

/** The picture as a listing picture; throws on any other. */
export function listedPicture(picture: Picture<SourceEntry>): Picture<ListingEntry> {
	return listedPictures([picture])[0]!
}

/** Asserts the series holds listing pictures only, as every series of a folder cull does. */
export function assertListedSeries(series: Series<Picture<SourceEntry>>): asserts series is Series<Picture<ListingEntry>> {
	listedPictures(series.members)
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
