import type { EmbeddedXmpAnswer } from './embedded-xmp.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarFailureReason, SidecarLookupAnswer, TakeOverLookup } from './sidecar-sync.ts'
import type { Tag } from './tag.ts'

import { embeddedSourceOf, embeddedXmpSource } from './embedded-xmp.ts'
import { pictureMembers } from './pairing.ts'
import { storableTags } from './tag.ts'
import { readableXmp } from './xmp/parse.ts'
import { pictureTags } from './xmp/tags.ts'

/** The file ids of the JPEGs whose embedded XMP the looked-up pictures without stored tags take tags over from (TAGS-002.16). */
export function embeddedLookups(lookups: readonly TakeOverLookup[], storedTagIds: ReadonlySet<number>): number[] {
	return lookups.filter(({ picture }) => !hasStoredTags(picture, storedTagIds)).flatMap(({ picture }) => embeddedXmpSource(picture)?.fileId ?? [])
}

/** The tags each looked-up picture without stored tags takes over from its sidecars and embedded XMP (TAGS-002.2, .15), those the storage cannot hold, and the JPEGs whose embedded XMP was not read (TAGS-002.17). */
export function takeOverTags(lookups: readonly TakeOverLookup[], answers: ReadonlyMap<number, SidecarLookupAnswer>, storedTagIds: ReadonlySet<number>, embedded: ReadonlyMap<number, EmbeddedXmpAnswer>) {
	const tagged: { readonly picture: Picture<ListingEntry>, readonly tags: Tag[] }[] = []
	const leftOut: Tag[] = []
	const unread: { readonly path: string, readonly reason: SidecarFailureReason }[] = []
	for (const { picture, sidecars } of lookups) {
		if (hasStoredTags(picture, storedTagIds)) {
			continue
		}
		const packets = sidecars.map((sidecar) => answers.get(sidecar.fileId)).flatMap((answer) => (answer?.result === 'read' ? readableXmp(answer.bytes) ?? [] : []))
		const jpeg = embeddedXmpSource(picture)
		if (jpeg !== null) {
			const source = embeddedSourceOf(embedded.get(jpeg.fileId))
			if ('failure' in source) {
				unread.push({ path: jpeg.path, reason: source.failure })
				continue
			}
			packets.push(...(source.packet === null ? [] : [source.packet]))
		}
		const { kept, leftOut: tooMany } = storableTags(pictureTags(packets))
		leftOut.push(...tooMany)
		if (kept.length > 0) {
			tagged.push({ picture, tags: kept })
		}
	}
	return { tagged, leftOut, unread }
}

/** Whether a member of the picture has stored tags. */
function hasStoredTags(picture: Picture<ListingEntry>, storedTagIds: ReadonlySet<number>): boolean {
	return pictureMembers(picture).some((member) => storedTagIds.has(member.fileId))
}
