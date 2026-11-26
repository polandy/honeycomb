// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref, ShallowRef } from 'vue'
import type { LibraryPage, LibraryScanning } from '../api/index.ts'
import type { FolderDone, FolderRow } from '../logic/folder-row.ts'

import { t } from '@nextcloud/l10n'
import { ref, shallowRef, watch } from 'vue'
import { isRecord } from '../api/core.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { logger } from '../shared/logger.ts'

/** The server seams of the list (FOLDERS-005). */
export interface LibraryApi {
	listLibraryFolders(root: string, after?: number, limit?: number): Promise<LibraryPage>
	checkLibraryRoot(root: string): Promise<void>
	scanLibrary(root: string): Promise<LibraryScanning>
}

/** What the *Folders* screen shows of the list. */
export interface FolderList {
	readonly rows: Readonly<ShallowRef<readonly FolderRow[]>>
	readonly state: Ref<'idle' | 'loading' | 'ready' | 'failed'>
	/** The summarised and all folders of the roots still scanning; null while none is. */
	readonly updating: Readonly<Ref<LibraryScanning | null>>
	/** False while a cull opened from anywhere hides the list. */
	readonly shown: Readonly<Ref<boolean>>
	refresh(): Promise<void>
}

/** What the list needs of the app. */
export interface FoldersOptions {
	/** The library roots; null until the settings are read. */
	roots(): readonly string[] | null
	/** Writes the cull's pending decisions, so the rows read after count them. */
	flush(): Promise<void>
	toastError(message: string): void
}

/** The answers that refuse a folder as a root: not on the user's own storage, or not theirs to read (FOLDERS-005). */
const REFUSED_STATUSES = new Set([400, 403])

/** The rows of every library root, read again while the server summarises stale folders (FOLDERS-007). */
export function useFolders(api: LibraryApi, options: FoldersOptions) {
	const rows = shallowRef<readonly FolderRow[]>([])
	const state = ref<FolderList['state']['value']>('idle')
	const updating = ref<LibraryScanning | null>(null)
	const shown = ref(true)
	const fromList = ref(false)
	let reads = 0

	/** Every page of one root's folders, and how far its summaries are. */
	async function readRoot(root: string): Promise<{ rows: FolderRow[], scanning: LibraryScanning | null }> {
		const first = await api.listLibraryFolders(root, 0)
		const read = [...first.folders]
		for (let next = first.nextCursor; next !== null;) {
			const page = await api.listLibraryFolders(root, next)
			read.push(...page.folders)
			next = page.nextCursor
		}
		return { rows: read, scanning: first.scanning }
	}

	/** Reads the rows of every root, then summarises the stale roots one after another. */
	async function refresh(): Promise<void> {
		const roots = options.roots() ?? []
		const generation = ++reads
		updating.value = null
		if (roots.length === 0) {
			rows.value = []
			state.value = 'idle'
			return
		}
		if (rows.value.length === 0) {
			state.value = 'loading'
		}
		let read: Awaited<ReturnType<typeof readRoot>>[]
		try {
			read = await Promise.all(roots.map(readRoot))
		} catch (error: unknown) {
			if (generation === reads) {
				logger.error('Could not read the library folders', { error })
				state.value = 'failed'
			}
			return
		}
		if (generation !== reads) {
			return
		}
		const byRoot = new Map(roots.map((root, index) => [root, read[index]!.rows]))
		const show = () => (rows.value = roots.flatMap((root) => byRoot.get(root)!))
		show()
		state.value = 'ready'
		const scanning = new Map(roots.flatMap((root, index) => (read[index]!.scanning === null ? [] : [[root, read[index]!.scanning!] as const])))
		await scan(scanning, generation, async (root) => {
			byRoot.set(root, (await readRoot(root)).rows)
			show()
		})
	}

	/** Summarises each root of `scanning` until it is done or a call brings no progress, then reads it again. */
	async function scan(scanning: Map<string, LibraryScanning>, generation: number, reread: (root: string) => Promise<void>): Promise<void> {
		const strip = () => (updating.value = scanning.size === 0 ? null : [...scanning.values()].reduce((sum, each) => ({ done: sum.done + each.done, total: sum.total + each.total })))
		strip()
		try {
			for (const [root, start] of [...scanning]) {
				for (let last = start; last.done < last.total;) {
					const next = await api.scanLibrary(root)
					if (generation !== reads) {
						return
					}
					if (next.done <= last.done) {
						break
					}
					last = next
					scanning.set(root, next)
					strip()
				}
				await reread(root)
				if (generation !== reads) {
					return
				}
				scanning.delete(root)
				strip()
			}
		} catch (error: unknown) {
			if (generation === reads) {
				logger.error('Could not update the library folders', { error })
				options.toastError(t('honeycomb', 'Could not update the folders.'))
				updating.value = null
			}
		}
	}

	/** Shows the list again once the cull's decisions are written, with its rows read again. */
	async function show(): Promise<void> {
		shown.value = true
		try {
			await options.flush()
		} catch (error: unknown) {
			logger.error('Could not write the decisions before the folders showed again', { error })
		}
		await refresh()
	}

	/** Hides the list for a cull; `opened` says whether the list opened it. */
	function leave(opened: boolean) {
		shown.value = false
		fromList.value = opened
	}

	/** Shows the folder's new done status in its row (FOLDERS-008). */
	function setDone(fileId: number, done: FolderDone | null) {
		rows.value = rows.value.map((each) => (each.fileId === fileId ? { ...each, done } : each))
	}

	/** Whether the server takes `root` as a library root: a folder of the user's own storage. */
	async function check(root: string): Promise<boolean> {
		try {
			await api.checkLibraryRoot(root)
			return true
		} catch (error: unknown) {
			if (isRecord(error) && isRecord(error.response) && REFUSED_STATUSES.has(error.response.status as number)) {
				return false
			}
			throw error
		}
	}

	watch(() => JSON.stringify(options.roots()), () => fireAndLog(refresh(), 'Could not refresh the folders'), { immediate: true })

	return { rows, state, updating, shown, fromList, refresh, show, leave, check, setDone }
}
