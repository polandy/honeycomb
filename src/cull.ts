// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Filters } from './logic/picture-filter.ts'
import type { SortOrder } from './logic/picture-order.ts'

import { computed, ref, shallowRef } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmFileIds } from './logic/cull.ts'
import { changedRows, commonDecision, resolveChange, revertRows, withRows } from './logic/decision-change.ts'
import { decisionsByFileId, pictureDecision } from './logic/decision.ts'
import { activeFilterCount, DEFAULT_FILTERS, emptyReason, filterPictures, pictureFolders, progress } from './logic/picture-filter.ts'
import { defaultSortOrder, sortPictures } from './logic/picture-order.ts'
import { parseTileSize } from './logic/tile-size.ts'

/** The browser storage key of the thumbnail size. */
export const TILE_SIZE_KEY = 'honeycomb.tileSize'

/** The server calls the cull makes. */
export interface CullApi {
	readonly warmPreviews: (fileIds: readonly number[]) => Promise<void>
	readonly lookupDecisions: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	readonly saveDecisions: (decisions: readonly StoredDecision[]) => Promise<void>
}

/** The open cull, its view settings and the folder picker's state. */
export function useCull(api: CullApi, storage: BrowserStorage) {
	const compareNames = nameComparer()
	const folderSet = ref<FolderSet | null>(null)
	const pictures = shallowRef<Picture<ListingEntry>[]>([])
	const decisions = shallowRef<ReadonlyMap<number, Decision>>(new Map())
	const filters = shallowRef<Filters>(DEFAULT_FILTERS)
	const sortOrder = ref<SortOrder>('file-name')
	const filtersOpen = ref(false)
	const pickerOpen = ref(true)
	const groupByFolder = ref(false)
	const tileSize = ref(parseTileSize(readStored(storage, TILE_SIZE_KEY)))
	const saveFailed = ref(false)
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const grouped = computed(() => groupByFolder.value && folders.value > 1)
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, decisions.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, filters.value), sortOrder.value, compareNames, grouped.value))
	const cullProgress = computed(() => progress(pictures.value, decisionOf))
	const activeFilters = computed(() => activeFilterCount(filters.value))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))

	/** Shows the pictures of the confirmed folders with fresh filters, then their stored decisions. */
	function open(set: FolderSet, entries: readonly ListingEntry[]) {
		folderSet.value = set
		pictures.value = prepareCull(entries).pictures
		decisions.value = new Map()
		saveFailed.value = false
		filters.value = DEFAULT_FILTERS
		sortOrder.value = defaultSortOrder(folders.value)
		pickerOpen.value = false
		api.warmPreviews(warmFileIds(view.value)).catch((error: unknown) => logger.error('Could not warm the previews', { error }))
		loadDecisions(pictures.value)
	}

	/** Reads the decisions of every member; they apply only while the same pictures are open, under changes made meanwhile. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		const fileIds = opened.flatMap((picture) => [picture.rendered, picture.raw].filter((member) => member !== null).map((member) => member.fileId))
		api.lookupDecisions(fileIds).then((rows) => {
			if (pictures.value === opened) {
				decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
			}
		}).catch((error: unknown) => logger.error('Could not read the decisions; every photo shows as undecided', { error }))
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = (chosen: readonly Picture<ListingEntry>[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<ListingEntry>[]) => commonDecision(decided(chosen))

	/** Shows the change at once and stores it; a failed save puts back what it replaced. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]) {
		const rows = changedRows(decided(chosen), resolveChange(intent, decided(chosen)))
		if (rows.length === 0) {
			return
		}
		const before = decisions.value
		const opened = pictures.value
		decisions.value = withRows(before, rows)
		saveFailed.value = false
		api.saveDecisions(rows).catch((error: unknown) => {
			logger.error('Could not save the decisions', { error })
			if (pictures.value === opened) {
				decisions.value = revertRows(decisions.value, rows, before)
				saveFailed.value = true
			}
		})
	}

	/** Switches the scope and keeps the filters. */
	function setScope(scope: Filters['scope']) {
		filters.value = { ...filters.value, scope }
	}

	/** Sets the thumbnail size and keeps it for the next visit. */
	function setTileSize(size: number) {
		tileSize.value = size
		writeStored(storage, TILE_SIZE_KEY, String(size))
	}

	return {
		folderSet,
		pictures,
		folderPaths,
		folders,
		grouped,
		view,
		progress: cullProgress,
		filters,
		activeFilters,
		empty,
		sortOrder,
		filtersOpen,
		pickerOpen,
		groupByFolder,
		tileSize,
		saveFailed,
		decisionOf,
		common,
		decide,
		open,
		setScope,
		setTileSize,
	}
}
