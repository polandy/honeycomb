// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { embeddedSidecarPath } from './embedded-xmp.ts'
import { splitFolder } from './file-name.ts'
import { memberIds, pictureMembers } from './pairing.ts'
import { isRawSidecar } from './sidecar-sync.ts'
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

/** The JPEG sidecar to seed before the RAW goes and the RAW sidecar it is read from: while the JPEG has none of its own or shared and the RAW has its own (DELETE-003.12). */
export function jpegSidecarOf(picture: Picture<ListingEntry>): { readonly path: string, readonly source: ListingEntry } | null {
	const { created, existing } = sidecarTargets(picture)
	const source = existing.find((entry) => isRawSidecar(picture, entry.path))
	if (picture.rendered === null || source === undefined || !created.includes(embeddedSidecarPath(picture.rendered))) {
		return null
	}
	return { path: embeddedSidecarPath(picture.rendered), source }
}
