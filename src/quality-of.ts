// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { QualityValue } from './logic/sharpness.ts'

import { sharpestMember } from './logic/sharpness.ts'

/** The quality value of a picture's shown member, or null while it has none. */
export type QualityOf = (picture: Picture<ListingEntry>) => QualityValue | null

/** The sharpness a quality lookup gives a picture, null while it has none. */
export function sharpnessBy(qualityOf: QualityOf) {
	return (picture: Picture<ListingEntry>) => qualityOf(picture)?.sharpness ?? null
}

/** The sharpest of `pictures` by their quality values (SERIES-007), or null. */
export function sharpestPicture(pictures: readonly Picture<ListingEntry>[], qualityOf: QualityOf): Picture<ListingEntry> | null {
	return sharpestMember(pictures, sharpnessBy(qualityOf))
}
