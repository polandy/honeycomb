// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Frame } from './auto-scroll.ts'
import type { Decision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Picture } from './logic/pairing.ts'
import type { Selection } from './logic/selection.ts'
import type { Series } from './logic/series.ts'
import type { Tag } from './logic/tag.ts'
import type { ObserveSize } from './observe-size.ts'

/** What the photo grid is given. */
export interface PhotoGridProps {
	/** The pictures in the grid's order. */
	pictures: readonly Picture<ListingEntry>[]
	folderSet: FolderSet
	groupByFolder: boolean
	/** The target tile size in CSS pixels. */
	tileSize: number
	observeSize?: ObserveSize
	imageUrl?: ImageUrlFor
	/** Resolves once the image at the URL is decoded, rejects if it cannot be. */
	loadImage?: (url: string) => Promise<void>
	selecting?: boolean
	/** The selected pictures by grid key, the file id of the member the tile shows. */
	selection?: Selection
	decisionOf?: (picture: Picture<ListingEntry>) => Decision
	/** The picture's tags, counted on its tile. */
	tagsOf?: (picture: Picture<ListingEntry>) => readonly Tag[]
	/** Whether the user may not change the picture, so its tile carries the lock (GRID-001.20). */
	readOnly?: (picture: Picture<ListingEntry>) => boolean
	/** Times the long-press and the tile info's delay. */
	schedule?: Schedule
	/** Times the auto-scroll of a drag selection. */
	frame?: Frame
	/** Every picture's series, offered or settled (SERIES-002.12). */
	seriesOf?: ReadonlyMap<Picture<ListingEntry>, Series<Picture<ListingEntry>>>
	/** The keys of the series the compare offers; the others are settled. */
	offeredSeries?: ReadonlySet<number>
	/** The pictures of a series that may still change (SERIES-003.25). */
	openSeries?: ReadonlySet<Picture<ListingEntry>>
	/** The picture whose sidecar writes still wait (XMP-003.28). */
	unsaved?: Picture<ListingEntry> | null
	/** Shows a name bar above each tile (GRID-004.4). */
	fileNames?: boolean
	/** Whether the pointer is coarse, so the name bar offers the ⓘ button (GRID-004.12). */
	touch?: boolean
}

/** What the photo grid emits. */
export type PhotoGridEmits = {
	'update:tileSize': [size: number]
	'update:selecting': [selecting: boolean]
	'update:selection': [selection: Selection]
	open: [index: number]
	compareSeries: [series: Series<Picture<ListingEntry>>, picture: Picture<ListingEntry>]
	/** The user scrolled the grid; a scroll it made itself does not count. */
	scroll: []
}
