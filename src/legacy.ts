// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LegacyExport, LegacyInventory } from './logic/legacy.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef, watch } from 'vue'
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

/** The legacy rows as the user sees them: the inventory while `active`, the acknowledgement after a run, export and discard (XMP-007.5–.9). */
export function useLegacy(api: LegacyApi, saveFile: (name: string, text: string) => void, toast: (message: string) => void, active: () => boolean) {
	const inventory = shallowRef<LegacyInventory | null>(null)
	const discarding = shallowRef(false)
	const shown = computed(() => active() && inventory.value !== null && (inventory.value.folders.length > 0 || inventory.value.unreachable > 0))

	/** Reads which folders still hold legacy rows; a failure shows no notice. */
	async function refresh() {
		try {
			inventory.value = await api.loadInventory()
		} catch (error) {
			inventory.value = null
			logger.error('Could not read which folders hold stored decisions', { error })
		}
	}

	/** Removes the legacy rows of the file ids whose sidecars hold them. */
	async function acknowledge(fileIds: readonly number[]) {
		try {
			await api.acknowledge(fileIds)
		} catch (error) {
			logger.error('Could not remove the stored decisions', { error })
			toast(t('honeycomb', 'Could not remove the stored decisions; run it again later.'))
		}
		await refresh()
	}

	/** Saves the rows of the unreachable file ids as a file. */
	async function exportRows() {
		try {
			saveFile(LEGACY_EXPORT_NAME, JSON.stringify(await api.loadExport(), null, '\t'))
		} catch (error) {
			logger.error('Could not export the stored decisions', { error })
			toast(t('honeycomb', 'Could not export the stored decisions.'))
		}
		await refresh()
	}

	/** Asks before discarding the rows of the unreachable file ids. */
	function askDiscard() {
		discarding.value = true
	}

	/** Keeps the rows of the unreachable file ids. */
	function cancelDiscard() {
		discarding.value = false
	}

	/** Removes the rows of the unreachable file ids, as the export holds them. */
	async function discard() {
		discarding.value = false
		let exported: LegacyExport
		try {
			exported = await api.loadExport()
		} catch (error) {
			logger.error('Could not export the stored decisions to discard them', { error })
			toast(t('honeycomb', 'Could not export the stored decisions.'))
			return
		}
		await acknowledge(exportedFileIds(exported))
	}

	watch(active, (isActive) => {
		if (isActive) {
			void refresh()
		}
	}, { immediate: true })

	return { inventory, shown, refresh, acknowledge, exportRows, askDiscard, cancelDiscard, discard, discarding }
}

/** The legacy rows of the app. */
export type Legacy = ReturnType<typeof useLegacy>
