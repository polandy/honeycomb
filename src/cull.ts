// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision, StoredDecision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { Filters } from './logic/picture-filter.ts'
import type { SortOrder } from './logic/picture-order.ts'
import type { Settings } from './logic/settings.ts'
import type { UndoEntry, UndoHistory } from './logic/undo.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { nameComparer } from './l10n.ts'
import { logger } from './logger.ts'
import { prepareCull, warmFileIds } from './logic/cull.ts'
import { commonDecision, resolveChange, revertRows, withRows } from './logic/decision-change.ts'
import { decisionsByFileId, pictureDecision } from './logic/decision.ts'
import { activeFilterCount, clearFilters, DEFAULT_FILTERS, emptyReason, filterPictures, pictureFolders, progress } from './logic/picture-filter.ts'
import { defaultSortOrder, sortPictures } from './logic/picture-order.ts'
import { pairingSettings } from './logic/settings.ts'
import { parseTileSize } from './logic/tile-size.ts'
import { withoutFiles } from './logic/trash-report.ts'
import { NO_HISTORY, recordStep, redoStep, undoEntry, undoStep } from './logic/undo.ts'

/** The browser storage key of the thumbnail size. */
export const TILE_SIZE_KEY = 'honeycomb.tileSize'

/** The server calls the cull makes. */
export interface CullApi {
	readonly warmPreviews: (fileIds: readonly number[]) => Promise<void>
	readonly lookupDecisions: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	readonly saveDecisions: (decisions: readonly StoredDecision[]) => Promise<void>
}

/** The open cull, its view settings and the folder picker's state; it pairs and shows singles as the settings say. */
export function useCull(api: CullApi, storage: BrowserStorage, settings: () => Settings) {
	const compareNames = nameComparer()
	const folderSet = ref<FolderSet | null>(null)
	const entries = shallowRef<readonly ListingEntry[]>([])
	const paired = shallowRef<Picture<ListingEntry>[]>([])
	const pairingKey = computed(() => JSON.stringify(pairingSettings(settings())))
	const pairing = computed(() => JSON.parse(pairingKey.value) as PairingSettings)
	const pictures = computed(() => (settings().showSingles ? paired.value : paired.value.filter((picture) => picture.raw !== null && picture.rendered !== null)))
	const decisions = shallowRef<ReadonlyMap<number, Decision>>(new Map())
	const filters = shallowRef<Filters>(DEFAULT_FILTERS)
	const sortOrder = ref<SortOrder>('file-name')
	const filtersOpen = ref(false)
	const pickerOpen = ref(true)
	const groupByFolder = ref(false)
	const tileSize = ref(parseTileSize(readStored(storage, TILE_SIZE_KEY)))
	const saveFailed = ref(false)
	let history: UndoHistory = NO_HISTORY
	let opening = 0
	let filtersOff: Filters | null = null
	const folderPaths = computed(() => pictureFolders(pictures.value, compareNames))
	const folders = computed(() => folderPaths.value.length)
	const grouped = computed(() => groupByFolder.value && folders.value > 1)
	const decisionOf = (picture: Picture<ListingEntry>) => pictureDecision(picture, decisions.value)
	const view = computed(() => sortPictures(filterPictures(pictures.value, decisionOf, filters.value), sortOrder.value, compareNames, grouped.value))
	const cullProgress = computed(() => progress(pictures.value, decisionOf))
	const activeFilters = computed(() => activeFilterCount(filters.value))
	const empty = computed(() => emptyReason(filters.value, pictures.value.length))

	/** Shows the pictures of the confirmed folders with fresh filters, then their stored decisions. */
	function open(set: FolderSet, listed: readonly ListingEntry[]) {
		folderSet.value = set
		opening++
		entries.value = listed
		paired.value = prepareCull(listed, pairing.value).pictures
		decisions.value = new Map()
		history = NO_HISTORY
		filtersOff = null
		saveFailed.value = false
		filters.value = DEFAULT_FILTERS
		sortOrder.value = defaultSortOrder(folders.value)
		pickerOpen.value = false
		api.warmPreviews(warmFileIds(view.value)).catch((error: unknown) => logger.error('Could not warm the previews', { error }))
		loadDecisions(paired.value)
	}

	watch(pairing, () => {
		paired.value = prepareCull(entries.value, pairing.value).pictures
		loadDecisions(paired.value)
	})

	/** Reads the decisions of every member; they apply only while the same pictures are open, under changes made meanwhile. */
	function loadDecisions(opened: readonly Picture<ListingEntry>[]) {
		const fileIds = opened.flatMap((picture) => [picture.rendered, picture.raw].filter((member) => member !== null).map((member) => member.fileId))
		api.lookupDecisions(fileIds).then((rows) => {
			if (paired.value === opened) {
				decisions.value = new Map([...decisionsByFileId(rows), ...decisions.value])
			}
		}).catch((error: unknown) => logger.error('Could not read the decisions; every photo shows as undecided', { error }))
	}

	/** The pictures with their decisions, as the decision rules take them. */
	const decided = (chosen: readonly Picture<ListingEntry>[]) => chosen.map((picture) => ({ picture, decision: decisionOf(picture) }))

	/** What the pictures share, for the action bar. */
	const common = (chosen: readonly Picture<ListingEntry>[]) => commonDecision(decided(chosen))

	/** Decides the pictures, keeps the step for undo and returns it, or null when nothing changes. */
	function decide(intent: DecisionIntent, chosen: readonly Picture<ListingEntry>[]): UndoEntry | null {
		const entry = undoEntry(decided(chosen), resolveChange(intent, decided(chosen)))
		if (entry !== null) {
			history = recordStep(history, entry)
			store(entry.after)
		}
		return entry
	}

	/** Puts back what the latest step replaced and returns it, or null when there is none. */
	function undo(): UndoEntry | null {
		const step = undoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		store(step.entry.before)
		return step.entry
	}

	/** Writes again what the latest undo took back and returns it, or null when there is none. */
	function redo(): UndoEntry | null {
		const step = redoStep(history)
		if (step === null) {
			return null
		}
		history = step.history
		store(step.entry.after)
		return step.entry
	}

	/** Shows the rows at once and stores them; a failed save puts back what they replaced. */
	function store(rows: readonly StoredDecision[]) {
		const before = decisions.value
		const opened = opening
		decisions.value = withRows(before, rows)
		saveFailed.value = false
		api.saveDecisions(rows).catch((error: unknown) => {
			logger.error('Could not save the decisions', { error })
			if (opening === opened) {
				decisions.value = revertRows(decisions.value, rows, before)
				saveFailed.value = true
			}
		})
	}

	/** Takes trashed files out of the pictures; returns what each affected picture became (ADR 0013). */
	function removeFiles(fileIds: ReadonlySet<number>) {
		const { pictures: left, replaced } = withoutFiles(paired.value, fileIds, pairing.value)
		entries.value = entries.value.filter((entry) => !fileIds.has(entry.fileId))
		paired.value = left
		return replaced
	}

	/** Switches the scope and keeps the filters. */
	function setScope(scope: Filters['scope']) {
		filters.value = { ...filters.value, scope }
	}

	/** Turns the filters off, keeping the scope; the next press turns them back on unless others were set meanwhile. */
	function toggleFiltersOff() {
		if (filtersOff !== null && activeFilters.value === 0) {
			filters.value = { ...filtersOff, scope: filters.value.scope }
			filtersOff = null
		} else {
			filtersOff = filters.value
			filters.value = clearFilters(filters.value)
		}
	}

	/** Sets the thumbnail size and keeps it for the next visit. */
	function setTileSize(size: number) {
		tileSize.value = size
		writeStored(storage, TILE_SIZE_KEY, String(size))
	}

	return {
		folderSet,
		pictures,
		pairing,
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
		undo,
		redo,
		open,
		removeFiles,
		setScope,
		toggleFiltersOff,
		setTileSize,
	}
}
