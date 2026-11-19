// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, StoredDecision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { StoredTags, Tag } from './tag.ts'

import { sameDecision, UNDECIDED } from './decision.ts'
import { memberIds } from './pairing.ts'

/** A picture with legacy rows: whether a member has a stored decision, and its stored tags. */
export interface LegacyWrite {
	readonly picture: Picture<ListingEntry>
	readonly decided: boolean
	readonly tags: readonly Tag[]
}

/** The folders still holding legacy rows, and how many file ids the user no longer reaches (XMP-007.1). */
export interface LegacyInventory {
	readonly folders: readonly { readonly path: string, readonly files: number }[]
	readonly unreachable: number
}

/** The legacy rows of the file ids the user no longer reaches (XMP-007.2). */
export interface LegacyExport {
	readonly decisions: readonly StoredDecision[]
	readonly tags: readonly StoredTags[]
}

/** The pictures with a stored decision other than undecided or a stored tag, in the given order (XMP-007.5). */
export function legacyWrites(
	pictures: readonly Picture<ListingEntry>[],
	decisions: ReadonlyMap<number, Decision>,
	tagsOf: (picture: Picture<ListingEntry>) => readonly Tag[],
): LegacyWrite[] {
	return pictures.flatMap((picture) => {
		const decided = memberIds(picture).some((fileId) => {
			const decision = decisions.get(fileId)
			return decision !== undefined && !sameDecision(decision, UNDECIDED)
		})
		const tags = tagsOf(picture)
		return decided || tags.length > 0 ? [{ picture, decided, tags }] : []
	})
}

/** Whether a picture of the cull has legacy rows to write (XMP-007.7). */
export function hasLegacyRows(writes: readonly LegacyWrite[]): boolean {
	return writes.length > 0
}

/** The member file ids of the written pictures without a failed sidecar, sorted (XMP-007.6). */
export function acknowledgedIds(writes: readonly LegacyWrite[], failed: readonly { readonly picture: Picture<ListingEntry> }[]): number[] {
	const failedPictures = new Set(failed.map(({ picture }) => picture))
	return writes.filter(({ picture }) => !failedPictures.has(picture)).flatMap(({ picture }) => memberIds(picture)).sort((a, b) => a - b)
}

/** Each file id of the export once, sorted, to discard them (XMP-007.8). */
export function exportedFileIds(exported: LegacyExport): number[] {
	return [...new Set([...exported.decisions, ...exported.tags].map(({ fileId }) => fileId))].sort((a, b) => a - b)
}
