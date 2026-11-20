// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, Flag, StoredDecision } from './decision.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'

import { UNDECIDED } from './decision.ts'
import { memberIds } from './pairing.ts'

/** The flag row fields a listing entry carries, `null` without a row (LISTING-001.18). */
export interface FlagFields {
	readonly flag: Flag | null
	readonly keepRaw: boolean | null
	readonly flagUpdated: number | null
}

/** A picture's flag and Keep RAW. */
export interface PictureFlag {
	readonly flag: Flag
	readonly keepRaw: boolean
}

/** The picture's state from the member row changed last, the first member on a tie; null without any row (DECISIONS-001.28). */
export function pictureFlag<T extends FlagFields>(picture: Picture<T>): PictureFlag | null {
	let latest: PictureFlag | null = null
	let latestUpdated = -Infinity
	for (const member of [picture.raw, picture.rendered]) {
		if (member !== null && member.flag !== null && member.flagUpdated !== null && member.flagUpdated > latestUpdated) {
			latest = { flag: member.flag, keepRaw: member.keepRaw ?? false }
			latestUpdated = member.flagUpdated
		}
	}
	return latest
}

/** The decision a read shows: the sidecars' rating and colour label, with the row's flag once taken over (XMP-003.34, .35, XMP-006.12). */
export function readDecision(listed: PictureFlag | null, stated: Decision): Decision {
	return listed === null ? stated : { ...stated, ...listed }
}

/** A row for each member of every picture whose members have a row, its other fields undecided (LISTING-001.18). */
export function listedRows<T extends FlagFields & { readonly fileId: PictureId }>(pictures: readonly Picture<T>[]): StoredDecision[] {
	return pictures.flatMap((picture) => {
		const listed = pictureFlag(picture)
		return listed === null ? [] : memberIds(picture).map((fileId) => ({ fileId, ...UNDECIDED, ...listed }))
	})
}
