// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { ref } from 'vue'
import { cleanUpWithToast, clearCacheWithToast } from '../settings/cache-clear.ts'
import { resetStatisticsWithToast } from '../statistics/statistics-reset.ts'

/** The server actions the settings dialog offers. */
export interface SettingsActions {
	readonly clearCache: () => Promise<void>
	readonly cleanUp: () => Promise<number>
	readonly resetStatistics: () => Promise<void>
}

/** How the dialogs tell the user how an action went. */
export interface DialogToast {
	readonly show: (message: string) => void
	readonly showError: (message: string) => void
}

/** The app shell's own dialogs: the settings, the shortcut sheet and the Immich connection details. */
export function useAppDialogs(actions: SettingsActions, toast: DialogToast) {
	const settingsOpen = ref(false)
	const shortcutsOpen = ref(false)
	const connectionOpen = ref(false)

	return {
		settingsOpen,
		shortcutsOpen,
		connectionOpen,
		/** Opens or closes the shortcut sheet. */
		toggleShortcuts: () => (shortcutsOpen.value = !shortcutsOpen.value),
		/** Whether a dialog that takes the keys is open; the shortcut sheet leaves them to the app. */
		holdsKeys: () => settingsOpen.value || connectionOpen.value,
		/** The settings dialog's actions, each with its toast. */
		settingsActions: {
			clearCache: () => clearCacheWithToast(actions.clearCache, toast.show, toast.showError),
			cleanUp: () => cleanUpWithToast(actions.cleanUp, toast.show, toast.showError),
			resetStatistics: () => resetStatisticsWithToast(actions.resetStatistics, toast.show, toast.showError),
		},
	}
}
