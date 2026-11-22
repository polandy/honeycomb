// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FoldersOptions, LibraryApi } from './folders.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ResumePosition } from './logic/resume-position.ts'

import { computed, watch } from 'vue'
import { useFolders } from './folders.ts'
import { folderSetKey } from './logic/folder-set.ts'

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
}

/** The list as the start screen: culls opened from it offer *Back to folders* (FOLDERS-007.13 to .16). */
export function useFoldersHome(api: LibraryApi, options: FoldersHomeOptions) {
	const folders = useFolders(api, options)
	/** The key of the folder set the list opened, null for one opened elsewhere. */
	let culled: string | null = null

	/** Culls one folder from the list, at its stored position when it has one. */
	function cull(set: FolderSet) {
		culled = folderSetKey(set)
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
	})

	return {
		...folders,
		/** The library roots; none until the settings are read. */
		roots: computed(() => options.roots() ?? []),
		cull,
		hide,
		back: () => void folders.show(),
		saveRoots: options.saveRoots,
		now: options.now,
	}
}

/** The list as the start screen, as the app wires it. */
export type FoldersHome = ReturnType<typeof useFoldersHome>
