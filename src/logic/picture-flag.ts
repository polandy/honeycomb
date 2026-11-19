// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './decision.ts'
import type { Picture } from './pairing.ts'

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
export function pictureFlag(picture: Picture<FlagFields>): PictureFlag | null {
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
