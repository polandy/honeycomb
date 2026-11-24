import type { QualityApi } from '../hashes/quality-values.ts'
import type { VisualHashApi } from '../hashes/visual-hashes.ts'
import type { Decision, DecisionField } from '../logic/decision.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { CountsOf } from '../logic/sidecar-pass.ts'
import type { SidecarFailure } from '../logic/sidecar-sync.ts'
import type { Tag, TagChange } from '../logic/tag.ts'
import type { XmpCacheRow } from '../logic/xmp-cache.ts'
import type { LookupSeries, SaveSeries } from '../series/stored-series.ts'
import type { WarmPreviews } from '../shared/preview-warmer.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullTagsApi } from './cull-tags.ts'
import type { FlagApi } from './flags-api.ts'

type Written = Promise<{ written: number, failed: SidecarFailure[] }>
type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>

/** How the cull reads decisions and tags from the sidecars and writes them through (XMP-003, TAGS-002). */
export interface SidecarWrites {
	readonly read: (pictures: readonly Picture<ListingEntry>[]) => Promise<{ decided: { picture: Picture<ListingEntry>, decision: Decision }[], tagged: { picture: Picture<ListingEntry>, tags: Tag[] }[], rows: ReadonlyMap<number, XmpCacheRow> }>
	readonly write: (pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, fields: readonly DecisionField[], paths?: Paths, counts?: CountsOf) => Written
	readonly writeTags: (pictures: readonly Picture<ListingEntry>[], change: TagChange, paths?: Paths, counts?: CountsOf) => Written
}

/** The server calls the cull makes, the visual hashing of its previews and the measuring of its series' photos. */
export interface CullApi extends VisualHashApi, QualityApi {
	readonly warmPreviews: WarmPreviews
	readonly flags: FlagApi
	readonly lookupSeries: LookupSeries
	readonly saveSeries: SaveSeries
	readonly tags: CullTagsApi
}
