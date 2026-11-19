// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { Tag } from './tag.ts'

import { embeddedSidecarPath } from './embedded-xmp.ts'
import { splitFolder } from './file-name.ts'
import { memberIds, pictureMembers } from './pairing.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** The flow that deletes by decision: Delete rejected, or Remove RAWs (ADR 0032 Deleting by decision). */
export type DecisionFlow = 'rejects' | 'raws'

/** Why a picture is skipped instead of deleted (DELETE-002.16). */
export type SkipReason = 'changed' | 'unlisted' | 'notRejected' | 'notRemovable' | 'jpegSidecar'

/** A picture the fresh check kept out of the delete, and why. */
export interface SkippedPicture {
	readonly picture: Picture<ListingEntry>
	readonly reason: SkipReason
}

const ROOT = '/'

/** The folders of every file of the pictures, each once in first-seen order, the root as `/`. */
export function freshFolders(pictures: readonly Picture<ListingEntry>[]): string[] {
	const paths = pictures.flatMap((picture) => [...pictureMembers(picture), ...picture.sidecars]).map((entry) => splitFolder(entry.path).parent)
	return [...new Set(paths.map((folder) => (folder === '' ? ROOT : folder)))]
}

/** Each picture with its fresh listing, matched by its members; one whose members changed is skipped. */
export function matchFresh(pictures: readonly Picture<ListingEntry>[], fresh: readonly Picture<ListingEntry>[]) {
	const byMembers = new Map(fresh.map((picture) => [memberIds(picture).join(), picture]))
	const matched: { readonly picture: Picture<ListingEntry>, readonly fresh: Picture<ListingEntry> }[] = []
	const skipped: SkippedPicture[] = []
	for (const picture of pictures) {
		const found = byMembers.get(memberIds(picture).join())
		if (found === undefined) {
			skipped.push({ picture, reason: 'changed' })
		} else {
			matched.push({ picture, fresh: found })
		}
	}
	return { matched, skipped }
}

/** The JPEG sidecar to create before the RAW goes: while the JPEG has none of its own or shared, the RAW has its own and the cull shows a rating, colour label or tag. */
export function jpegSidecarOf(picture: Picture<ListingEntry>, decision: Decision, tags: readonly Tag[]): string | null {
	const { created, existing } = sidecarTargets(picture)
	if (picture.rendered === null || existing.length === 0 || !created.includes(embeddedSidecarPath(picture.rendered))) {
		return null
	}
	const holdsValues = decision.rating !== 0 || decision.colourLabel !== null || tags.length > 0
	return holdsValues ? embeddedSidecarPath(picture.rendered) : null
}
