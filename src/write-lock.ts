// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from './cull.ts'
import type { Settings } from './logic/settings.ts'
import type { OpenedFolder, WriteLock } from './logic/writability.ts'

import { computed, shallowRef } from 'vue'
import { splitFolder } from './logic/file-name.ts'
import { withConfirmedFolders } from './logic/settings.ts'

/** A step held back until writing is On and its shared folders are confirmed (XMP-008.7). */
export function useWriteLock(settings: () => Settings, update: (patch: Partial<Settings>) => void, retried: (step: CullStep | null) => void) {
	const asking = shallowRef<WriteLock<CullStep> | null>(null)
	const turnsOn = computed(() => asking.value?.reason === 'off')
	const sharedNames = computed(() => (asking.value?.folders ?? []).map(({ path }) => splitFolder(path).name || '/'))

	/** Asks to lift the lock. */
	function locked(lock: WriteLock<CullStep>) {
		asking.value = lock
	}

	/** Turns writing On and confirms the shared folders in one save, then takes the step again. */
	function confirm() {
		const lock = asking.value
		asking.value = null
		if (lock === null) {
			return
		}
		const confirmed = lock.folders.map(({ fileId }) => fileId)
		update({ sidecarWrite: 'on', ...(confirmed.length > 0 ? confirmedPatch(confirmed) : {}) })
		retried(lock.retry())
	}

	/** The settings change that confirms the opened folders. */
	function confirmedPatch(fileIds: readonly number[]): Partial<Settings> {
		return { confirmedSharedFolders: withConfirmedFolders(settings().confirmedSharedFolders, fileIds) }
	}

	/** Confirms one opened folder's shared folders, as the migration dialog offers (XMP-007.13). */
	function confirmFolder(folder: OpenedFolder) {
		update(confirmedPatch([folder.fileId]))
	}

	/** Leaves the step untaken. */
	function cancel() {
		asking.value = null
	}

	return { asking, turnsOn, sharedNames, locked, confirm, confirmFolder, cancel }
}
