// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarLookupAnswer, TakeOverLookup } from './sidecar-sync.ts'
import type { Tag } from './tag.ts'

import { pictureMembers } from './pairing.ts'
import { storableTags } from './tag.ts'
import { readableXmp } from './xmp/parse.ts'
import { pictureTags } from './xmp/tags.ts'

/** The tags each looked-up picture without stored tags takes over from its sidecars (TAGS-002.2), and those the storage cannot hold. */
export function takeOverTags(lookups: readonly TakeOverLookup[], answers: ReadonlyMap<number, SidecarLookupAnswer>, storedTagIds: ReadonlySet<number>) {
	const tagged: { readonly picture: Picture<ListingEntry>, readonly tags: Tag[] }[] = []
	const leftOut: Tag[] = []
	for (const { picture, sidecars } of lookups) {
		if (pictureMembers(picture).some((member) => storedTagIds.has(member.fileId))) {
			continue
		}
		const { kept, leftOut: tooMany } = storableTags(pictureTags(sidecars.map((sidecar) => answers.get(sidecar.fileId)).flatMap((answer) => (answer?.result === 'read' ? readableXmp(answer.bytes) ?? [] : []))))
		leftOut.push(...tooMany)
		if (kept.length > 0) {
			tagged.push({ picture, tags: kept })
		}
	}
	return { tagged, leftOut }
}
