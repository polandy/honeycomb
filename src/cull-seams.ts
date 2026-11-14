// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullTagsApi } from './cull-tags.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { Tag, TagChange } from './logic/tag.ts'
import type { WarmPreviews } from './preview-warmer.ts'
import type { HashImage } from './visual-hashes.ts'

type Written = Promise<{ written: number, failed: SidecarFailure[] }>

/** How the cull takes decisions and tags over from the sidecars and writes them through (XMP-003, TAGS-002). */
export interface CullSidecars {
	readonly takeOver: (pictures: readonly Picture<ListingEntry>[], storedIds: ReadonlySet<number>, storedTagIds: ReadonlySet<number> | null) => Promise<{ decided: { picture: Picture<ListingEntry>, decision: Decision }[], tagged: { picture: Picture<ListingEntry>, tags: Tag[] }[] }>
	readonly write: (pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision) => Written
	readonly writeTags: (pictures: readonly Picture<ListingEntry>[], change: TagChange) => Written
}

/** The server calls the cull makes, and the visual hashing of its previews. */
export interface CullApi {
	readonly hashImage: HashImage
	readonly warmPreviews: WarmPreviews
	readonly lookupDecisions: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	readonly saveDecisions: (decisions: readonly StoredDecision[]) => Promise<void>
	readonly tags: CullTagsApi
}
