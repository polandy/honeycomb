// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { flushPromises, mount } from '@vue/test-utils'
import App from '../../src/App.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
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
		}
	}
}

/** A stored decision of the file with the given flag. */
export function stored(fileId: number, flag: StoredDecision['flag']): StoredDecision {
	return { fileId, rating: 0, colourLabel: null, flag, keepRaw: false }
}

export function mountApp(props: Record<string, unknown> = {}, decisions: StoredDecision[] = []) {
	const warmed: number[][] = []
	const lookedUp: number[][] = []
	const saved: StoredDecision[][] = []
	const wrapper = mount(App, {
		props: {
			storage: fakeStorage(),
			warmPreviews: async (ids: readonly number[]) => { warmed.push([...ids]) },
			lookupDecisions: async (ids: readonly number[]) => {
				lookedUp.push([...ids])
				return decisions
			},
			saveDecisions: async (rows: readonly StoredDecision[]) => { saved.push([...rows]) },
			...props,
		},
		global: { stubs: { FolderPicker: true, PhotoGrid: true, GridToolbar: true, FilterBar: true } },
	})
	return { wrapper, warmed, lookedUp, saved }
}

/** The base names of the pictures the grid shows, in its order. */
export function shownNames(wrapper: AppWrapper): string[] {
	return wrapper.findComponent(PhotoGrid).props('pictures').map((picture: { baseName: string }) => picture.baseName)
}

/** Confirms the folder set in the folder picker, reopened from the toolbar on an open cull. */
export async function openCull(wrapper: AppWrapper, set = SET, entries = ENTRIES) {
	if (!wrapper.findComponent(FolderPicker).exists()) {
		wrapper.findComponent(GridToolbar).vm.$emit('changeFolders')
		await flushPromises()
	}
	wrapper.findComponent(FolderPicker).vm.$emit('confirm', set, entries)
	await flushPromises()
}

/** The mounted app. */
export type AppWrapper = ReturnType<typeof mountApp>['wrapper']
