// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Frame } from './auto-scroll.ts'
import type { Decision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { SourceEntry } from './logic/listing.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { Selection } from './logic/selection.ts'
import type { Series } from './logic/series.ts'
import type { Tag } from './logic/tag.ts'
import type { ObserveSize } from './observe-size.ts'

/** What the photo grid is given. */
export interface PhotoGridProps {
	/** The pictures in the grid's order. */
	pictures: readonly Picture<SourceEntry>[]
	/** The folder set the group headers name their folders within; without one a header shows its folder as it is. */
	folderSet?: FolderSet | undefined
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
	decisionOf?: (picture: Picture<SourceEntry>) => Decision
	/** The picture's tags, counted on its tile. */
	tagsOf?: (picture: Picture<SourceEntry>) => readonly Tag[]
	/** Whether the user may not change the picture, so its tile carries the lock (GRID-001.20). */
	readOnly?: (picture: Picture<SourceEntry>) => boolean
	/** Times the long-press and the tile info's delay. */
	schedule?: Schedule
	/** Times the auto-scroll of a drag selection. */
	frame?: Frame
	/** Every picture's series, offered or settled (SERIES-002.12). */
	seriesOf?: ReadonlyMap<Picture<SourceEntry>, Series<Picture<SourceEntry>>>
	/** The keys of the series the compare offers; the others are settled. */
	offeredSeries?: ReadonlySet<PictureId>
	/** The pictures of a series that may still change (SERIES-003.25). */
	openSeries?: ReadonlySet<Picture<SourceEntry>>
	/** Whether the series may still change because the stored ones are being read (SERIES-005.30). */
	busy?: boolean
	/** The picture whose sidecar writes still wait (XMP-003.28). */
	unsaved?: Picture<SourceEntry> | null
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
	compareSeries: [series: Series<Picture<SourceEntry>>, picture: Picture<SourceEntry>]
	/** The user scrolled the grid; a scroll it made itself does not count. */
	scroll: []
	/** The index of the last tile rendered, one screen below the viewport, for paging (IMMICH-002.6). */
	shown: [last: number]
}
