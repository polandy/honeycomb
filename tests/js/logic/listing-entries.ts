// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { DEFAULT_PAIRING_SETTINGS, pairPictures } from '../../../src/logic/pairing.ts'

/** A listing entry for `path` without EXIF basics, overridable field by field. */
export function listingEntry(fileId: number, path: string, fields: Partial<ListingEntry> = {}): ListingEntry {
	return {
		fileId,
		path,
		size: 1,
		mtime: 1000,
		etag: `etag-${fileId}`,
		mime: 'image/jpeg',
		captureTime: null,
		orientation: null,
		width: null,
		height: null,
		camera: null,
		visualHash: null,
		...fields,
	}
}

/** The pictures of the entries under the default pairing settings. */
export function picturesOf(entries: readonly ListingEntry[]): Picture<ListingEntry>[] {
	return pairPictures(entries, DEFAULT_PAIRING_SETTINGS)
}

/** The one picture of the entries. */
export function pictureOf(...entries: ListingEntry[]): Picture<ListingEntry> {
	const [picture] = picturesOf(entries)
	return picture!
}
