// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { QualityValue } from '../logic/sharpness.ts'

import { sharpestMember } from '../logic/sharpness.ts'

/** The quality value of a picture's shown member, or null while it has none. */
export type QualityOf = (picture: Picture<SourceEntry>) => QualityValue | null

/** The sharpness a quality lookup gives a picture, null while it has none. */
export function sharpnessBy(qualityOf: QualityOf) {
	return (picture: Picture<SourceEntry>) => qualityOf(picture)?.sharpness ?? null
}

/** The sharpest of `pictures` by their quality values (SERIES-007), or null. */
export function sharpestPicture<P extends Picture<SourceEntry>>(pictures: readonly P[], qualityOf: QualityOf): P | null {
	return sharpestMember(pictures, sharpnessBy(qualityOf))
}
