// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullStep } from './cull.ts'
import type { Settings } from './logic/settings.ts'
import type { WriteLock } from './logic/writability.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { splitFolder } from './logic/file-name.ts'
import { withConfirmedFolders } from './logic/settings.ts'

/** What a toast says for a lock the user cannot lift here (XMP-008.7). */
const LOCK_TEXT = {
	readOnly: () => t('honeycomb', 'Not changed: you may only read this folder'),
	noVersions: () => t('honeycomb', 'Not changed: this folder keeps no versions'),
	refused: () => t('honeycomb', 'Not changed: a sidecar of this photo was refused; see Details of the last write'),
}

/** A step held back until writing is On and its shared folders are confirmed, or a toast naming why it was not taken (XMP-008.7). */
export function useWriteLock(settings: () => Settings, update: (patch: Partial<Settings>) => void, toast: (message: string) => void, retried: (step: CullStep | null) => void) {
	const asking = shallowRef<WriteLock<CullStep> | null>(null)
	const turnsOn = computed(() => asking.value?.reason === 'off')
	const sharedNames = computed(() => (asking.value?.folders ?? []).map(({ path }) => splitFolder(path).name || '/'))

	/** Asks about a lock the user can lift; names any other in a toast. */
	function locked(lock: WriteLock<CullStep>) {
		if (lock.reason === 'off' || lock.reason === 'shared') {
			asking.value = lock
			return
		}
		toast(LOCK_TEXT[lock.reason]())
	}

	/** Turns writing On and confirms the shared folders in one save, then takes the step again. */
	function confirm() {
		const lock = asking.value
		asking.value = null
		if (lock === null) {
			return
		}
		const confirmed = lock.folders.map(({ fileId }) => fileId)
		update({ sidecarWrite: 'on', ...(confirmed.length > 0 ? { confirmedSharedFolders: withConfirmedFolders(settings().confirmedSharedFolders, confirmed) } : {}) })
		retried(lock.retry())
	}

	/** Leaves the step untaken. */
	function cancel() {
		asking.value = null
	}

	return { asking, turnsOn, sharedNames, locked, confirm, cancel }
}
