// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullSidecars } from '../../src/cull-seams.ts'
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { SeriesWrite } from '../../src/logic/series-edit.ts'
import type { Settings } from '../../src/logic/settings.ts'
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { StoredViewState, ViewState } from '../../src/logic/view-state.ts'
import type { ListedAccess } from '../../src/logic/writability.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import App from '../../src/App.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
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

/** The default settings with writing to sidecars on, so a cull may decide. */
export const WRITING_ON: Settings = { ...DEFAULT_SETTINGS, sidecarWrite: 'on' }

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

/** A grid that records the moves and reveals it is asked for and has its focus where the test puts it. */
export function gridStub() {
	const calls = { steps: [] as string[], revealed: [] as number[], focused: 0 }
	const component = defineComponent({
		props: ['pictures', 'folderSet', 'groupByFolder', 'tileSize', 'selecting', 'selection', 'decisionOf', 'tagsOf', 'seriesSizes', 'openSeries'],
		setup(_props, { expose, slots }) {
			expose({
				reveal: async (index: number) => {
					calls.revealed.push(index)
				},
				step: async (move: string) => {
					calls.steps.push(move)
				},
				focusedIndex: () => calls.focused,
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

/** Sidecars with nothing to take over, written without a word. */
export const NO_SIDECARS: CullSidecars = { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) }

/** Legacy endpoints without a legacy row. */
export const NO_LEGACY = { loadInventory: async () => ({ folders: [], unreachable: 0 }), loadExport: async () => ({ decisions: [], tags: [] }), acknowledge: async () => undefined }
/** A series save that keeps each series' id and gives a new one 100. */
export const SAVED_SERIES = async (write: SeriesWrite) => ({ ids: write.series.map(({ id }) => id ?? 100) })

/** Tag endpoints that store nothing. */
export const NO_TAGS = { lookupTags: async () => [], saveTags: async () => undefined, loadTagList: async () => [] }

export function mountApp(props: Record<string, unknown> = {}, decisions: StoredDecision[] = [], stubs: Record<string, unknown> = {}) {
	provideSkipActions()
	const warmed: number[][] = []
	const lookedUp: number[][] = []
	const saved: StoredDecision[][] = []
	const savedSettings: object[] = []
	const sidecarSaves: SidecarSaveItem[][] = []
	const grid = gridStub()
	const wrapper = mount(App, {
		props: {
			storage: fakeStorage(),
			hashImage: () => new Promise(() => undefined),
			saveVisualHashes: async () => undefined,
			warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) },
			lookupDecisions: async (ids: readonly number[]) => {
				lookedUp.push([...ids])
				return decisions
			},
			saveDecisions: async (rows: readonly StoredDecision[]) => { saved.push([...rows]) },
			lookupSeries: NO_SERIES,
			saveSeries: SAVED_SERIES,
			tags: NO_TAGS,
			legacy: NO_LEGACY,
			saveFile: () => undefined,
			loadSettings: async () => ({ sidecarWrite: 'on' }),
			saveSettings: async (settings: object) => { savedSettings.push(settings) },
			positions: { loadPositions: async () => [], savePosition: async () => undefined },
			viewState: { loadViewState: async () => ({ infoPanelOpen: null, gestureGuideSeen: true, seriesHintSeen: true }), saveViewState: async () => undefined },
			sidecars: {
				lookupSidecars: async (ids: readonly number[]) => ids.map(() => ({ result: 'notFound' })),
				lookupEmbeddedXmp: async (ids: readonly number[]) => ids.map(() => ({ result: 'none' })),
				saveSidecars: async (items: readonly SidecarSaveItem[]) => {
					sidecarSaves.push([...items])
					return items.map((_, index) => ({ result: 'saved', fileId: 100 + index, etag: 'e', size: 1, mtime: 1 }))
				},
				now: () => ({ epochMs: 0, offsetMinutes: 0 }),
			},
			...props,
		},
		global: { stubs: { AppNavigation: true, FolderPicker: true, PhotoGrid: grid.component, GridToolbar: true, FilterBar: true, PhotoLoupe: true, SettingsDialog: true, ...stubs } },
	})
	return { wrapper, warmed, lookedUp, saved, savedSettings, sidecarSaves, grid: grid.calls }
}

/** The base names of the pictures the grid shows, in its order. */
export function shownNames(wrapper: AppWrapper): string[] {
	return wrapper.findComponent(PhotoGrid).props('pictures').map((picture: { baseName: string }) => picture.baseName)
}

/** The access of a cull of `/Trip`, opened as file id 7, whose folders in `shared` are shared. */
export function sharedAccess(shared: readonly string[]): ListedAccess {
	return { folders: shared.map((path) => ({ path, shared: true, permissions: 31, versions: true })), opened: [{ path: '/Trip', fileId: 7 }] }
}

/** Confirms the folder set in the folder picker, reopened from the toolbar on an open cull. */
export async function openCull(wrapper: AppWrapper, set = SET, entries = ENTRIES, access: ListedAccess = NO_ACCESS) {
	if (!wrapper.findComponent(FolderPicker).exists()) {
		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()
	}
	wrapper.findComponent(FolderPicker).vm.$emit('confirm', set, entries, access)
	await flushPromises()
}

/** The toolbar's groups flattened into one object, as the tests read them. */
export function toolbarProps(wrapper: AppWrapper) {
	const { folders, view, progress, selection, tasks } = wrapper.findComponent(GridToolbar).props()
	return { folderSet: folders.set, folders: folders.count, ...view, ...progress, ...selection, ...tasks }
}

/** The mounted app. */
export type AppWrapper = ReturnType<typeof mountApp>['wrapper']
