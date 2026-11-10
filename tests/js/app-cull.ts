// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { StoredViewState, ViewState } from '../../src/logic/view-state.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import App from '../../src/App.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
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

/** A grid that records the moves and reveals it is asked for and has its focus where the test puts it. */
export function gridStub() {
	const calls = { steps: [] as string[], revealed: [] as number[], focused: 0 }
	const component = defineComponent({
		props: ['pictures', 'folderSet', 'groupByFolder', 'tileSize', 'selecting', 'selection', 'decisionOf', 'seriesSizes'],
		setup(_props, { expose }) {
			expose({
				reveal: async (index: number) => {
					calls.revealed.push(index)
				},
				step: async (move: string) => {
					calls.steps.push(move)
				},
				focusedIndex: () => calls.focused,
			})
			return () => h('div')
		},
	})
	return { component, calls }
}

export function mountApp(props: Record<string, unknown> = {}, decisions: StoredDecision[] = [], stubs: Record<string, unknown> = {}) {
	const warmed: number[][] = []
	const lookedUp: number[][] = []
	const saved: StoredDecision[][] = []
	const savedSettings: object[] = []
	const sidecarSaves: SidecarSaveItem[][] = []
	const grid = gridStub()
	const wrapper = mount(App, {
		props: {
			storage: fakeStorage(),
			warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) },
			lookupDecisions: async (ids: readonly number[]) => {
				lookedUp.push([...ids])
				return decisions
			},
			saveDecisions: async (rows: readonly StoredDecision[]) => { saved.push([...rows]) },
			loadSettings: async () => ({}),
			saveSettings: async (settings: object) => { savedSettings.push(settings) },
			positions: { loadPositions: async () => [], savePosition: async () => undefined },
			viewState: { loadViewState: async () => ({ infoPanelOpen: null, gestureGuideSeen: true }), saveViewState: async () => undefined },
			sidecars: {
				lookupSidecars: async (ids: readonly number[]) => ids.map(() => ({ result: 'notFound' })),
				saveSidecars: async (items: readonly SidecarSaveItem[]) => {
					sidecarSaves.push([...items])
					return items.map((_, index) => ({ result: 'saved', fileId: 100 + index, etag: 'e', size: 1, mtime: 1 }))
				},
				now: () => ({ epochMs: 0, offsetMinutes: 0 }),
			},
			...props,
		},
		global: { stubs: { FolderPicker: true, PhotoGrid: grid.component, GridToolbar: true, FilterBar: true, PhotoLoupe: true, SettingsDialog: true, ...stubs } },
	})
	return { wrapper, warmed, lookedUp, saved, savedSettings, sidecarSaves, grid: grid.calls }
}

/** The base names of the pictures the grid shows, in its order. */
export function shownNames(wrapper: AppWrapper): string[] {
	return wrapper.findComponent(PhotoGrid).props('pictures').map((picture: { baseName: string }) => picture.baseName)
}

/** Confirms the folder set in the folder picker, reopened from the toolbar on an open cull. */
export async function openCull(wrapper: AppWrapper, set = SET, entries = ENTRIES, sharedFolders: readonly string[] = []) {
	if (!wrapper.findComponent(FolderPicker).exists()) {
		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()
	}
	wrapper.findComponent(FolderPicker).vm.$emit('confirm', set, entries, sharedFolders)
	await flushPromises()
}

/** The mounted app. */
export type AppWrapper = ReturnType<typeof mountApp>['wrapper']
