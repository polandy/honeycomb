import type { FolderDoneApi } from '../../src/folders/folder-done.ts'
import type { LibraryApi } from '../../src/folders/folders.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderRow } from '../../src/logic/folder-row.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CullFinished from '../../src/components/CullFinished.vue'
import FoldersHome from '../../src/components/FoldersHome.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { ENTRIES, mountApp, openCull, shownNames } from './app-cull.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const TRIP = row({ fileId: 7, path: '/Photos/Trip', photos: 3, undecided: 0, picked: 3, rejected: 0 })
const DONE = { by: 'andy', at: 1_800_000_000, photos: 3 }

/** The app with the root /Photos holding `rows`, and a library that records its done writes. */
function openApp(rows: FolderRow[] = [TRIP]) {
	const writes: string[] = []
	let listed = rows
	const library: LibraryApi & FolderDoneApi = {
		listLibraryFolders: async () => ({ folders: listed, nextCursor: null, scanning: null }),
		scanLibrary: async () => ({ done: 0, total: 0 }),
		markFolderDone: async (fileId, photos) => {
			writes.push(`PUT ${fileId} ${photos}`)
			listed = listed.map((each) => (each.fileId === fileId ? { ...each, done: DONE } : each))
			return DONE
		},
		reopenFolder: async (fileId) => {
			writes.push(`DELETE ${fileId}`)
		},
	}
	const mounted = mountApp({
		library,
		loadSettings: async () => ({ libraryRoots: ['/Photos'] }),
		listEntries: async () => ({ entries: ENTRIES, truncated: false, folders: [] }),
	})
	return { ...mounted, writes }
}

type App = ReturnType<typeof openApp>['wrapper']

const home = (wrapper: App) => wrapper.findComponent(FoldersHome).props('home')

enableAutoUnmount(afterEach)

describe('App: the done status', () => {
	// spec: FOLDERS-008.7
	it('opens Cull new with the flag filter Unflagged only, and a later Cull with the default filter', async () => {
		const grown = doneRow({ fileId: 8, path: '/Photos/Grown', photos: 12 }, 10)
		const { wrapper } = openApp([grown])
		await flushPromises()

		home(wrapper).cullNew({ paths: ['/Photos/Grown'], subfolders: false })
		await flushPromises()
		expect([...wrapper.findComponent(GridToolbar).props('view').flags]).toEqual(['unflagged'])

		wrapper.findComponent(GridToolbar).vm.$emit('back')
		await flushPromises()
		home(wrapper).cull({ paths: ['/Photos/Grown'], subfolders: false })
		await flushPromises()
		expect([...wrapper.findComponent(GridToolbar).props('view').flags]).toEqual(['picked', 'unflagged'])
	})

	// spec: FOLDERS-008.8
	it('marks the one folder of a cull from the list done from the card, then shows the list with the toast', async () => {
		const { wrapper, writes } = openApp()
		await flushPromises()
		home(wrapper).cull({ paths: ['/Photos/Trip'], subfolders: false })
		await flushPromises()
		expect(home(wrapper).finishing.value).toEqual(TRIP)

		await home(wrapper).markFinished()
		await flushPromises()

		expect(writes).toEqual(['PUT 7 3'])
		expect(home(wrapper).shown.value).toBe(true)
		expect(home(wrapper).rows.value[0]?.done).toEqual(DONE)
		expect(wrapper.findComponent(UndoToast).props('toast').message).toBe('Marked Trip done')
	})

	// spec: FOLDERS-008.8
	it('offers Mark folder done on the card and closes the card when the user presses it', async () => {
		const { wrapper, grid, writes } = openApp()
		await flushPromises()
		home(wrapper).cull({ paths: ['/Photos/Trip'], subfolders: false })
		await flushPromises()
		for (const name of ['IMG_2', 'IMG_10', 'IMG_9']) {
			grid.focused = shownNames(wrapper).indexOf(name)
			document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true, cancelable: true }))
			await flushPromises()
		}
		expect(wrapper.findComponent(CullFinished).props('markable')).toBe(true)

		wrapper.findComponent(CullFinished).vm.$emit('markDone')
		wrapper.findComponent(CullFinished).vm.$emit('close')
		await flushPromises()

		expect(writes).toEqual(['PUT 7 3'])
		expect(wrapper.findComponent(CullFinished).exists()).toBe(false)
	})

	// spec: FOLDERS-008.9
	it.each<[string, FolderRow[], FolderSet]>([
		['two folders', [TRIP], { paths: ['/Photos/Trip', '/Photos/Other'], subfolders: false }],
		['subfolders', [TRIP], { paths: ['/Photos/Trip'], subfolders: true }],
		['a folder outside the roots', [TRIP], { paths: ['/Elsewhere'], subfolders: false }],
		['a read-only folder', [{ ...TRIP, permissions: 1 }], { paths: ['/Photos/Trip'], subfolders: false }],
		['a done folder', [{ ...TRIP, done: DONE }], { paths: ['/Photos/Trip'], subfolders: false }],
	])('offers no Mark folder done for %s', async (_case, rows, set) => {
		const { wrapper } = openApp(rows)
		await flushPromises()

		await openCull(wrapper, set)

		expect(home(wrapper).finishing.value).toBeNull()
	})
})
