// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './logic/folder-set.ts'
import type { LegacyExport, LegacyInventory } from './logic/legacy.ts'

import { n, t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'
import { logger } from './logger.ts'
import { exportedFileIds } from './logic/legacy.ts'

/** The name the export of the unreachable legacy rows is saved under (XMP-007.8). */
export const LEGACY_EXPORT_NAME = 'honeycomb-legacy-rows.json'

/** The legacy endpoints (XMP-007.1–.3). */
export interface LegacyApi {
	readonly loadInventory: () => Promise<LegacyInventory>
	readonly loadExport: () => Promise<LegacyExport>
	readonly acknowledge: (fileIds: readonly number[]) => Promise<void>
}

/** The legacy rows as the user sees them: the inventory, read at once, the acknowledgement after a run, a copy, forgetting and opening a folder (XMP-007.5–.10). */
export function useLegacy(api: LegacyApi, saveFile: (name: string, text: string) => void, toast: (message: string) => void, openFolderSet: (folderSet: FolderSet) => void) {
	const inventory = shallowRef<LegacyInventory | null>(null)
	const forgetting = shallowRef(false)
	const shown = computed(() => inventory.value !== null && (inventory.value.folders.length > 0 || inventory.value.unreachable > 0))

	/** Reads which folders still hold legacy rows; a failure shows no notice. */
	async function refresh() {
		try {
			inventory.value = await api.loadInventory()
		} catch (error) {
			inventory.value = null
			logger.error('Could not read which folders hold stored decisions', { error })
		}
	}

	/** Removes the legacy rows of the file ids whose sidecars hold them; answers whether it did. */
	async function acknowledge(fileIds: readonly number[]): Promise<boolean> {
		let removed = true
		try {
			await api.acknowledge(fileIds)
		} catch (error) {
			removed = false
			logger.error('Could not remove the stored decisions', { error })
			toast(t('honeycomb', 'Could not remove the stored decisions; run it again later.'))
		}
		await refresh()
		return removed
	}

	/** Saves the rows of the unreachable file ids as a file and says so. */
	async function exportRows() {
		try {
			saveFile(LEGACY_EXPORT_NAME, JSON.stringify(await api.loadExport(), null, '\t'))
			toast(t('honeycomb', 'Saved a copy as {name}', { name: LEGACY_EXPORT_NAME }, undefined, PLAIN_TEXT))
		} catch (error) {
			logger.error('Could not export the stored decisions', { error })
			toast(t('honeycomb', 'Could not export the stored decisions.'))
		}
		await refresh()
	}

	/** Asks before forgetting the rows of the unreachable file ids. */
	function askForget() {
		forgetting.value = true
	}

	/** Keeps the rows of the unreachable file ids. */
	function cancelForget() {
		forgetting.value = false
	}

	/** Removes the rows of the unreachable file ids, as the export holds them, and says how many. */
	async function forget() {
		forgetting.value = false
		let exported: LegacyExport
		try {
			exported = await api.loadExport()
		} catch (error) {
			logger.error('Could not export the stored decisions to forget them', { error })
			toast(t('honeycomb', 'Could not export the stored decisions.'))
			return
		}
		const fileIds = exportedFileIds(exported)
		if (await acknowledge(fileIds)) {
			toast(n('honeycomb', 'Forgot the stored decisions of {count} file', 'Forgot the stored decisions of {count} files', fileIds.length, { count: formatNumber(fileIds.length) }, PLAIN_TEXT))
		}
	}

	/** Opens a folder of the notice alone, without subfolders (XMP-007.10). */
	function openFolder(path: string) {
		openFolderSet({ paths: [path], subfolders: false })
	}

	void refresh()

	return { inventory, shown, refresh, acknowledge, exportRows, askForget, cancelForget, forget, forgetting, openFolder }
}

/** The legacy rows of the app. */
export type Legacy = ReturnType<typeof useLegacy>
