import type { QualityOf } from '../hashes/quality-of.ts'
import type { DecisionIntent } from '../logic/decision-change.ts'
import type { Decision } from '../logic/decision.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { LoupeCounter } from '../logic/immich-paging.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Schedule } from '../logic/long-press.ts'
import type { SourceCapabilities } from '../logic/opened-source.ts'
import type { Picture } from '../logic/pairing.ts'
import type { Series } from '../logic/series.ts'
import type { Settings } from '../logic/settings.ts'
import type { Tag } from '../logic/tag.ts'
import type { Writability } from '../logic/writability.ts'
import type { ViewStateStore } from '../settings/view-state.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from '../shared/browser-storage.ts'
import type { ObserveSize } from '../shared/observe-size.ts'
import type { Toast } from '../shared/toast.ts'

/** What the loupe is given. */
export interface PhotoLoupeProps {
	/** The pictures the loupe pages through, the grid's order when it opened. */
	pictures: readonly Picture<SourceEntry>[]
	index: number
	/** The folder set of a folder source, for the info panel's Folder row. */
	folderSet?: FolderSet | undefined
	/** What the source offers beside deciding; everything unless given (IMMICH-002.17). */
	capabilities?: SourceCapabilities
	/** The place against the source's own total, for a source that pages (IMMICH-002.9). */
	counter?: LoupeCounter | null
	decisionOf: (picture: Picture<SourceEntry>) => Decision
	/** Whether the picture counts as decided, by its flag unless given (SERIES-005.14). */
	decidedOf?: (picture: Picture<SourceEntry>) => boolean
	/** Each picture of a series mapped to its whole series, for the filmstrip's frame (LOUPE-001.19). */
	seriesOf?: ReadonlyMap<Picture<SourceEntry>, Series<Picture<SourceEntry>>>
	/** The series members' quality values, for the *Sharpest* mark, the rank and the zoom onto the focus tile (SERIES-007). */
	qualityOf?: QualityOf
	/** The picture's tags for the info panel (TAGS-004.8). */
	tagsOf?: (picture: Picture<SourceEntry>) => readonly Tag[]
	writabilityOf?: (picture: Picture<SourceEntry>) => Writability
	/** The picture whose sidecar save waits, shown as a ring in the title row (LOUPE-001.27). */
	unsaved?: Picture<SourceEntry> | null
	storage: BrowserStorage
	viewState: ViewStateStore
	settings: Settings
	imageUrl?: ImageUrlFor
	decode?: (src: string) => Promise<void>
	schedule?: Schedule
	toggleFullscreen?: (element: HTMLElement) => void
	devicePixelRatio?: number
	observeSize?: ObserveSize
}

/** What the loupe emits. */
export type PhotoLoupeEmits = {
	'update:index': [index: number]
	decide: [intent: DecisionIntent, picture: Picture<SourceEntry>]
	toast: [toast: Toast]
	allDecided: []
	move: []
	updateSettings: [patch: Partial<Settings>]
	tag: [picture: Picture<SourceEntry>]
	/** Opens the compare on the series with the picture active (LOUPE-001.25). */
	compareSeries: [series: Series<Picture<SourceEntry>>, picture: Picture<SourceEntry>]
	/** Picks the shown picture and rejects the rest of its series (LOUPE-002.15). */
	pickRest: [series: Series<Picture<SourceEntry>>, picture: Picture<SourceEntry>]
	close: []
}
