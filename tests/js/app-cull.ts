// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarWrites } from '../../src/cull-seams.ts'
import type { FlagApi, FlagItem } from '../../src/flags-api.ts'
import type { FolderDoneApi } from '../../src/folder-done.ts'
import type { LibraryApi } from '../../src/folders.ts'
import type { ImmichCullApi } from '../../src/immich-cull.ts'
import type { ImmichApi } from '../../src/immich-source.ts'
import type { Decision, StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { SeriesWrite } from '../../src/logic/series-edit.ts'
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { StoredViewState, ViewState } from '../../src/logic/view-state.ts'
import type { ListedAccess } from '../../src/logic/writability.ts'
import type { SidecarFlowApi } from '../../src/sidecar-flow.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import App from '../../src/App.vue'
import AppNavigation from '../../src/components/AppNavigation.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { sameDecision, UNDECIDED } from '../../src/logic/decision.ts'
import { FAILED_STATUS, NO_IMMICH } from '../../src/logic/immich-connections.ts'
import { DEFAULT_PAIRING_SETTINGS, memberIds, pairPictures } from '../../src/logic/pairing.ts'
import { NO_ACCESS } from '../../src/logic/writability.ts'
import { useViewState } from '../../src/view-state.ts'
import { listingEntry } from './logic/listing-entries.ts'

export const ENTRIES = [
	listingEntry(1, '/Trip/B/IMG_2.JPG'),
	listingEntry(2, '/Trip/A/IMG_10.JPG'),
	listingEntry(3, '/Trip/A/IMG_10.CR3', { mime: 'image/x-dcraw' }),
	listingEntry(4, '/Trip/A/IMG_9.JPG'),
]
export const SET: FolderSet = { paths: ['/Trip'], subfolders: true }

/** A storage over a plain map, or one that throws like a browser with site data blocked. */
export function fakeStorage(stored: Record<string, string> = {}, blocked = false) {
	return () => {
		if (blocked) {
			throw new DOMException('blocked', 'SecurityError')
		}
		return {
			getItem: (key: string) => stored[key] ?? null,
			setItem: (key: string, value: string) => {
				stored[key] = value
			},
			removeItem: (key: string) => {
				delete stored[key]
			},
		}
	}
}

/** The view state over a server that answers `stored` and records each write in `saved`. */
export function fakeViewState(stored: Partial<StoredViewState> = {}, saved: Partial<ViewState>[] = []) {
	return useViewState({
		loadViewState: async () => stored,
		saveViewState: async (patch) => {
			saved.push(patch)
		},
	}, fakeStorage())
}

/** A stored decision of the file with the given flag. */
export function stored(fileId: number, flag: StoredDecision['flag']): StoredDecision {
	return { fileId, rating: 0, colourLabel: null, flag, keepRaw: false }
}

/** A flag API over a table of rows as the server keeps them, which records each save and take-over. */
export function fakeFlags(rows: readonly StoredDecision[] = []) {
	const table = new Map<number, FlagItem>(rows.map(({ fileId, flag, keepRaw }) => [fileId, { fileId, flag, keepRaw }]))
	const saves: FlagItem[][] = []
	const takenOver: FlagItem[][] = []
	const api: { -readonly [K in keyof FlagApi]: FlagApi[K] } = {
		save: async (items) => {
			saves.push([...items])
			items.forEach((item) => table.set(item.fileId, item))
			return { saved: items.map(({ fileId }) => fileId), skipped: [] }
		},
		takeOver: async (items) => {
			takenOver.push([...items])
			const inserted = items.filter(({ fileId }) => !table.has(fileId))
			inserted.forEach((item) => table.set(item.fileId, item))
			return { saved: inserted.map(({ fileId }) => fileId), skipped: items.filter((item) => !inserted.includes(item)).map(({ fileId }) => ({ fileId, reason: 'exists' })) }
		},
	}
	/** The entries as a listing carries them, with the table's rows. */
	const listed = (entries: readonly ListingEntry[]): ListingEntry[] => entries.map((entry) => {
		const row = table.get(entry.fileId)
		return row === undefined ? entry : { ...entry, flag: row.flag, keepRaw: row.keepRaw, flagUpdated: 1 }
	})
	return { api, saves, takenOver, listed }
}

/** The flag table of each mounted app, which its listings carry. */
const flagTables = new WeakMap<object, ReturnType<typeof fakeFlags>>()

/** A grid that records the moves and reveals it is asked for and has its focus where the test puts it. */
export function gridStub() {
	const calls = { steps: [] as string[], revealed: [] as number[], jumps: [] as string[], focused: 0 }
	const component = defineComponent({
		props: ['pictures', 'folderSet', 'groupByFolder', 'tileSize', 'selecting', 'selection', 'decisionOf', 'tagsOf', 'seriesOf', 'offeredSeries', 'openSeries', 'unsaved', 'fileNames', 'imageUrl'],
		setup(_props, { expose, slots }) {
			expose({
				reveal: async (index: number) => {
					calls.revealed.push(index)
				},
				step: async (move: string) => {
					calls.steps.push(move)
				},
				focusedIndex: () => calls.focused,
				jumpSeries: async (direction: string) => {
					calls.jumps.push(direction)
				},
			})
			return () => h('div', slots.default?.())
		},
	})
	return { component, calls }
}

/** The `#skip-actions` target Nextcloud's page holds, where NcContent teleports its skip links. */
export function provideSkipActions() {
	if (document.getElementById('skip-actions') === null) {
		document.body.append(Object.assign(document.createElement('div'), { id: 'skip-actions' }))
	}
}

/** A series lookup with nothing stored. */
export const NO_SERIES = async () => ({ series: [], keptOut: [] })

/** Sidecars with nothing to read, written without a word. */
export const NO_SIDECARS: SidecarWrites = { read: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) }

/** A series save that keeps each series' id and gives a new one 100. */
export const SAVED_SERIES = async (write: SeriesWrite) => ({ ids: write.series.map(({ id }) => id ?? 100) })

/** A tag list that is empty. */
export const NO_TAGS = { loadTagList: async () => [] }

/** Sidecar endpoints that find no sidecar and save each one, recorded in `saves`. */
export function sidecarApi(saves: SidecarSaveItem[][] = []): SidecarFlowApi {
	return {
		lookupSidecars: async (ids: readonly number[]) => ids.map(() => ({ result: 'notFound' })),
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupEmbeddedXmp: async (ids: readonly number[]) => ids.map(() => ({ result: 'none' })),
		saveSidecars: async (items: readonly SidecarSaveItem[]) => {
			saves.push([...items])
			return items.map((_, index) => ({ result: 'saved', fileId: 100 + index, etag: 'e', size: 1, mtime: 1 }))
		},
		now: () => ({ epochMs: 0, offsetMinutes: 0 }),
	}
}

/** An Immich seam without connections, so no test reaches the network. */
const NO_IMMICH_API: ImmichApi = { listConnections: async () => NO_IMMICH, status: async () => FAILED_STATUS }
/** The wall clock the app's Immich time filter counts from, noon UTC on 20 November 2026. */
const NOW_SECONDS = 1_795_176_000
/** An Immich server that never answers the cull's requests. */
export const SILENT_IMMICH_CULL: ImmichCullApi = { assets: () => new Promise(() => undefined), counts: () => new Promise(() => undefined), saveDecisions: () => new Promise(() => undefined), imageUrl: (id, assetId, size) => `/${id}/${assetId}/${size}` }

/** A library without folders, never scanning. */
export const NO_LIBRARY: LibraryApi & FolderDoneApi = { listLibraryFolders: async () => ({ folders: [], next: null, scanning: null }), scanLibrary: async () => ({ done: 0, total: 0 }), markFolderDone: async () => ({ by: '', at: 0, photos: 0 }), reopenFolder: async () => undefined }

export function mountApp(props: Record<string, unknown> = {}, decisions: StoredDecision[] = [], stubs: Record<string, unknown> = {}) {
	provideSkipActions()
	const warmed: number[][] = []
	const flags = fakeFlags(decisions)
	const savedSettings: object[] = []
	const sidecarSaves: SidecarSaveItem[][] = []
	const grid = gridStub()
	const wrapper = mount(App, {
		props: {
			storage: fakeStorage(),
			hashImage: () => new Promise(() => undefined),
			saveVisualHashes: async () => undefined,
			measureImage: async () => ({ sharpness: 0, focusTile: 0 }),
			saveQualityValues: async () => undefined,
			warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) },
			flags: flags.api,
			lookupSeries: NO_SERIES,
			saveSeries: SAVED_SERIES,
			tags: NO_TAGS,
			saveFile: () => undefined,
			loadSettings: async () => ({}),
			saveSettings: async (settings: object) => { savedSettings.push(settings) },
			positions: { loadPositions: async () => [], savePosition: async () => undefined },
			location: { read: () => '', write: () => undefined },
			viewState: { loadViewState: async () => ({ infoPanelOpen: null, gestureGuideSeen: true, seriesHintSeen: true }), saveViewState: async () => undefined },
			sidecars: sidecarApi(sidecarSaves),
			immich: NO_IMMICH_API,
			immichCull: SILENT_IMMICH_CULL,
			now: () => NOW_SECONDS,
			library: NO_LIBRARY,
			...props,
		},
		global: { stubs: { AppNavigation: true, FoldersHome: true, FolderPicker: true, PhotoGrid: grid.component, GridToolbar: true, FilterBar: true, PhotoLoupe: true, SettingsDialog: true, ...stubs } },
	})
	flagTables.set(wrapper, flags)
	return { wrapper, warmed, flagSaves: flags.saves, takenOver: flags.takenOver, savedSettings, sidecarSaves, grid: grid.calls }
}

/** Each member of a decided picture of the entries as `fileId flag`, by file id. */
export function decidedFlags(wrapper: AppWrapper, entries: readonly ListingEntry[] = ENTRIES): string[] {
	return decidedRows(wrapper, entries).map(({ fileId, flag }) => `${fileId} ${flag}`)
}

/** Each member of a decided picture of the entries with the decision the cull holds, shown or not, by file id. */
export function decidedRows(wrapper: AppWrapper, entries: readonly ListingEntry[] = ENTRIES): StoredDecision[] {
	const decisionOf = wrapper.findComponent(PhotoGrid).props('decisionOf') as (picture: Picture<ListingEntry>) => Decision
	return pairPictures(entries, DEFAULT_PAIRING_SETTINGS)
		.filter((picture) => !sameDecision(decisionOf(picture), UNDECIDED))
		.flatMap((picture) => memberIds(picture).map((fileId) => ({ fileId, ...decisionOf(picture) })))
		.sort((a, b) => a.fileId - b.fileId)
}

/** The base names of the pictures the grid shows, in its order. */
export function shownNames(wrapper: AppWrapper): string[] {
	return wrapper.findComponent(PhotoGrid).props('pictures').map((picture: { baseName: string }) => picture.baseName)
}

/** Confirms the folder set in the folder picker, opened from the toolbar on an open cull or else from the navigation; the entries carry the app's flag rows. */
export async function openCull(wrapper: AppWrapper, set = SET, entries = ENTRIES, access: ListedAccess = NO_ACCESS) {
	// The picker shows once the start has read the settings (IMMICH-001.23).
	await flushPromises()
	if (!wrapper.findComponent(FolderPicker).exists()) {
		const toolbar = wrapper.findComponent(GridToolbar)
		if (toolbar.exists()) {
			toolbar.vm.$emit('changeFolders')
		} else {
			wrapper.findComponent(AppNavigation).vm.$emit('chooseFolders')
		}
		await flushPromises()
	}
	wrapper.findComponent(FolderPicker).vm.$emit('confirm', set, flagTables.get(wrapper)?.listed(entries) ?? entries, access)
	await flushPromises()
}

/** The toolbar's groups flattened into one object, as the tests read them. */
export function toolbarProps(wrapper: AppWrapper) {
	const { folders, view, progress, selection, tasks } = wrapper.findComponent(GridToolbar).props()
	return { folderSet: folders.set, folders: folders.count, ...view, ...progress, ...selection, ...tasks }
}

/** The mounted app. */
export type AppWrapper = ReturnType<typeof mountApp>['wrapper']
