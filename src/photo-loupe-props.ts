// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Picture } from './logic/pairing.ts'
import type { Series } from './logic/series.ts'
import type { Settings } from './logic/settings.ts'
import type { Tag } from './logic/tag.ts'
import type { Writability } from './logic/writability.ts'
import type { ObserveSize } from './observe-size.ts'
import type { QualityOf } from './quality-of.ts'
import type { Toast } from './toast.ts'
import type { ViewStateStore } from './view-state.ts'

/** What the loupe is given. */
export interface PhotoLoupeProps {
	/** The pictures the loupe pages through, the grid's order when it opened. */
	pictures: readonly Picture<ListingEntry>[]
	index: number
	folderSet: FolderSet
	decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** Whether the picture counts as decided, by its flag unless given (SERIES-005.14). */
	decidedOf?: (picture: Picture<ListingEntry>) => boolean
	/** Each picture of a series mapped to its whole series, for the filmstrip's frame (LOUPE-001.19). */
	seriesOf?: ReadonlyMap<Picture<ListingEntry>, Series<Picture<ListingEntry>>>
	/** The series members' quality values, for the *Sharpest* mark, the rank and the zoom onto the focus tile (SERIES-007). */
	qualityOf?: QualityOf
	/** The picture's tags for the info panel (TAGS-004.8). */
	tagsOf?: (picture: Picture<ListingEntry>) => readonly Tag[]
	writabilityOf?: (picture: Picture<ListingEntry>) => Writability
	/** The picture whose sidecar save waits, shown as a ring in the title row (LOUPE-001.27). */
	unsaved?: Picture<ListingEntry> | null
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
	decide: [intent: DecisionIntent, picture: Picture<ListingEntry>]
	toast: [toast: Toast]
	allDecided: []
	move: []
	updateSettings: [patch: Partial<Settings>]
	tag: [picture: Picture<ListingEntry>]
	/** Opens the compare on the series with the picture active (LOUPE-001.25). */
	compareSeries: [series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>]
	/** Picks the shown picture and rejects the rest of its series (LOUPE-002.15). */
	pickRest: [series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>]
	close: []
}
