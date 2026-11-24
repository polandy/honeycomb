// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureFlag } from './picture-flag.ts'
import type { PictureId } from './picture-id.ts'
import type { SidecarEtagItem } from './sidecar-etags.ts'
import type { XmpCacheRow } from './xmp-cache.ts'
import type { ExportPlan } from './xmp-export.ts'

import { UNDECIDED } from './decision.ts'
import { pictureMembers } from './pairing.ts'
import { pictureFlag } from './picture-flag.ts'
import { isReadNow, memberSidecarEntry } from './sidecar-etags.ts'
import { isPair } from './sidecar-sync.ts'
import { differs, exportPlan } from './xmp-export.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** What a visit's sync compares: the read rows, what the sidecars state, the ETags recorded this session and the sidecars honeycomb created. */
export interface FlagSyncInput {
	readonly rows: ReadonlyMap<number, XmpCacheRow>
	readonly stated: (picture: Picture<ListingEntry>) => Decision
	readonly knownEtags: ReadonlyMap<PictureId, string | null>
	readonly known: ReadonlyMap<string, { readonly fileId: PictureId }>
}

/** What the sync does: the pictures it takes over, the ETags it records and the sidecars it writes (ADR 0056). */
export interface FlagSync {
	readonly takenOver: { readonly picture: Picture<ListingEntry>, readonly flag: PictureFlag }[]
	readonly etags: SidecarEtagItem[]
	readonly plan: ExportPlan
}

/** Compares each listed picture that has rows and whose sidecars were all read in their listed version with those sidecars, taking over a flag changed elsewhere and writing the row otherwise (XMP-003.46 to .49). */
export function flagSync(pictures: readonly Picture<ListingEntry>[], input: FlagSyncInput): FlagSync {
	const takenOver: FlagSync['takenOver'] = []
	const etags: SidecarEtagItem[] = []
	const finals = new Map<Picture<ListingEntry>, Decision>()
	for (const picture of pictures) {
		const listed = pictureFlag(picture)
		if (listed === null || !sidecarTargets(picture).existing.every((entry) => isReadNow(entry, input.rows))) {
			continue
		}
		const pair = isPair(picture)
		const members = pictureMembers(picture).map((member) => {
			const entry = memberSidecarEntry(picture, member)
			const stored = input.knownEtags.has(member.fileId) ? input.knownEtags.get(member.fileId)! : member.sidecarEtag
			return { member, entry, stored, row: entry === undefined ? undefined : input.rows.get(entry.fileId) }
		})
		const rowState = { ...UNDECIDED, ...listed }
		const disagrees = sidecarTargets(picture).existing.some(({ fileId }) => differs(input.rows.get(fileId)!, rowState, pair))
		const changed = members.some(({ entry, stored }) => entry !== undefined && stored !== null && entry.etag !== stored)
		const stated = input.stated(picture)
		const final: PictureFlag = { flag: stated.flag, keepRaw: pair ? stated.keepRaw : listed.keepRaw }
		const takesOver = disagrees && changed && (final.flag !== listed.flag || final.keepRaw !== listed.keepRaw)
		const decision = { ...UNDECIDED, ...(takesOver ? final : listed) }
		if (takesOver) {
			takenOver.push({ picture, flag: final })
		}
		finals.set(picture, decision)
		etags.push(...members.flatMap(({ member, entry, stored, row }) => (entry !== undefined && row !== undefined && entry.etag !== stored && !differs(row, decision, pair) ? [{ fileId: member.fileId, sidecarEtag: entry.etag }] : [])))
	}
	return { takenOver, etags, plan: exportPlan([...finals.keys()], (picture) => finals.get(picture)!, input.rows, input.known) }
}
