// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderDoneApi, FolderDoneOptions } from './folder-done.ts'
import type { FoldersOptions, LibraryApi } from './folders.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { Filters } from './logic/picture-filter.ts'
import type { ResumePosition } from './logic/resume-position.ts'

import { computed, watch } from 'vue'
import { useFolderDone } from './folder-done.ts'
import { useFolders } from './folders.ts'
import { isRateable } from './logic/folder-row.ts'
import { folderSetKey } from './logic/folder-set.ts'

/** The flag filter of *Cull new*: the photos not yet decided (FOLDERS-008.7). */
const NEW_FLAGS: Filters['flags'] = new Set(['unflagged'])

/** How the *Folders* screen opens and leaves culls in the app. */
export interface FoldersHomeOptions extends FoldersOptions {
	/** The open cull's folder set. */
	folderSet(): FolderSet | null
	/** Whether a folder set is being listed to open. */
	listing(): boolean
	positionOf(set: FolderSet): ResumePosition | null
	/** Opens a folder set at its stored position, as *Recent* does. */
	openPosition(position: ResumePosition): void
	/** Opens a folder set at the start of its grid. */
	openSet(set: FolderSet): Promise<void>
	/** Stores the roots the setup chose (FOLDERS-007.5). */
	saveRoots(roots: string[]): void
	/** The current time in Unix seconds; it sets the progress card's month. */
	now(): number
	toast: FolderDoneOptions['toast']
	/** Sets the open cull's flag filter. */
	setFlags(flags: Filters['flags']): void
}

/** The list as the start screen: culls opened from it offer *Back to folders* (FOLDERS-007.13 to .16). */
export function useFoldersHome(api: LibraryApi & FolderDoneApi, options: FoldersHomeOptions) {
	const folders = useFolders(api, options)
	const done = useFolderDone(api, { setDone: folders.setDone, toast: options.toast, toastError: options.toastError })
	/** The key of the folder set the list opened, null for one opened elsewhere. */
	let culled: string | null = null
	/** Whether the cull the list opens shows the new photos only. */
	let newOnly = false

	/** Culls one folder from the list, at its stored position when it has one. */
	function cull(set: FolderSet) {
		open(set, false)
	}

	/** Culls a done folder's new photos: the folder with the flag filter *Unflagged* (FOLDERS-008.7). */
	function cullNew(set: FolderSet) {
		open(set, true)
	}

	/** Opens the folder set from the list, with the flag filter *Unflagged* when `onlyNew`. */
	function open(set: FolderSet, onlyNew: boolean) {
		culled = folderSetKey(set)
		newOnly = onlyNew
		folders.leave(true)
		const position = options.positionOf(set)
		if (position === null) {
			void options.openSet(set)
		} else {
			options.openPosition(position)
		}
	}

	/** Hides the list for a cull opening elsewhere, keeping whether the list opened the cull. */
	const hide = () => folders.leave(folders.fromList.value)
	watch(options.listing, (listing) => listing && hide())

	// Any folder set opened hides the list; only the one the list opened keeps *Back to folders*.
	watch(options.folderSet, (set) => {
		if (set === null) {
			return
		}
		const fromList = culled === folderSetKey(set)
		if (!fromList) {
			culled = null
		}
		folders.leave(fromList)
		// The open reset the filters; the new photos' filter goes on after it.
		if (fromList && newOnly) {
			options.setFlags(NEW_FLAGS)
		}
		newOnly = false
	})

	/** The row the open cull may mark done on *Cull finished*: one folder without subfolders, rateable and open (FOLDERS-008.8). */
	const finishing = computed(() => {
		const set = options.folderSet()
		if (set === null || set.subfolders || set.paths.length !== 1) {
			return null
		}
		const row = folders.rows.value.find((each) => each.path === set.paths[0])
		return row !== undefined && isRateable(row) && row.done === null ? row : null
	})

	/** Marks the finished cull's folder done; a cull from the list goes back to it. */
	async function markFinished(): Promise<void> {
		const row = finishing.value
		if (row === null) {
			return
		}
		await done.markDone(row)
		if (folders.fromList.value) {
			await folders.show()
		}
	}

	return {
		...folders,
		/** The library roots; none until the settings are read. */
		roots: computed(() => options.roots() ?? []),
		cull,
		cullNew,
		hide,
		markDone: done.markDone,
		reopen: done.reopen,
		changed: done.changed,
		finishing,
		markFinished,
		back: () => void folders.show(),
		saveRoots: options.saveRoots,
		now: options.now,
	}
}

/** The list as the start screen, as the app wires it. */
export type FoldersHome = ReturnType<typeof useFoldersHome>
