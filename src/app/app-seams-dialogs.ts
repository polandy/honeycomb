// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SettingsList, StoredSettings } from '../logic/settings.ts'
import type { ViewStateApi } from '../settings/view-state.ts'

import { loadSettings as apiLoadSettings, saveSettings as apiSaveSettings, cleanUpOrphanedData, loadViewState, saveSettingsList, saveViewState } from '../api/index.ts'
import { clearCache } from '../sidecars/xmp-cache-api.ts'

/** The element the server renders the app into, which carries its data attributes. */
const APP_ELEMENT = 'honeycomb'

/** The seams of the settings and the dialogs: settings, view state and the settings actions. */
export interface DialogSeams {
	loadSettings?: () => Promise<unknown>
	saveSettings?: (settings: StoredSettings) => Promise<void>
	saveSettingsList?: (name: SettingsList, items: readonly string[]) => Promise<void>
	viewState?: ViewStateApi
	clearCache?: () => Promise<void>
	/** Whether the user is an admin, who may clean up the orphaned data (SETTINGS-001.27). */
	admin?: () => boolean
	cleanUp?: () => Promise<number>
}

/** The dialogs seams the app uses in production. */
export const DIALOG_SEAMS = {
	loadSettings: apiLoadSettings,
	saveSettings: apiSaveSettings,
	saveSettingsList,
	viewState: () => ({ loadViewState, saveViewState }),
	clearCache,
	admin: () => document.getElementById(APP_ELEMENT)?.dataset.admin === 'true',
	cleanUp: cleanUpOrphanedData,
}
