// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Flag } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { SortOrder } from './logic/picture-order.ts'

/** The folders of the cull. */
export interface ToolbarFolders {
	readonly set: FolderSet
	/** How many folders the cull's pictures are in. */
	readonly count: number
	/** The cull was opened from *Folders*: the toolbar goes back to it, not to the folder picker. */
	readonly back: boolean
}

/** How the grid shows the cull. */
export interface ToolbarView {
	readonly tileSize: number
	readonly groupByFolder: boolean
	/** Whether each tile has its name bar (GRID-004). */
	readonly fileNames: boolean
	readonly sortOrder: SortOrder
	/** The pressed flags of the flag filter. */
	readonly flags: ReadonlySet<Flag>
	readonly filtersOpen: boolean
	/** How many filter groups have a choice, each chosen tag counting as one. */
	readonly activeFilters: number
}

/** How far the shown photos are decided. */
export interface ToolbarProgress {
	readonly decided: number
	readonly total: number
	/** Whether the filters hide photos of the cull. */
	readonly filtered: boolean
}

/** Selection mode and how many pictures it holds. */
export interface ToolbarSelection {
	readonly selecting: boolean
	readonly selected: number
}

/** What the toolbar's actions act on; each action is held while it has nothing. */
export interface ToolbarTasks {
	/** How many pictures are rejected. */
	readonly rejected: number
	/** How many series are left to compare. */
	readonly series: number
	/** How many series *Reduce series to the sharpest* decides (SERIES-008.2). */
	readonly reducible: number
	readonly rawRemovable: number
	/** How many rateable pictures *Clear picks/rejects* resets. */
	readonly clearable: number
	/** How many XMP files *Write picks/rejects to XMP* writes. */
	readonly xmpToWrite: number
	/** How many pictures *Move picks* or, while a filter is on, *Move filtered* opens the move dialog on. */
	readonly movable: number
	/** The base name of the picture *Resume* opens the loupe at, null when there is none. */
	readonly resumeName: string | null
}
