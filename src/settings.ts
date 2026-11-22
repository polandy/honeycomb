// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings, SettingsList, StoredSettings } from './logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { ref, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { DEFAULT_SETTINGS, parseSettings, splitChange, storedSettings } from './logic/settings.ts'

/** The server seams of the settings (ADR 0014, ADR 0051). */
export interface SettingsApi {
	loadSettings(): Promise<unknown>
	saveSettings(settings: StoredSettings): Promise<void>
	saveSettingsList(name: SettingsList, items: readonly string[]): Promise<void>
}

/** The user's settings: the defaults until the stored ones arrive, each change applied at once and saved whole, a list on its own. */
export function useSettings(api: SettingsApi, toast: (message: string) => void) {
	const settings = shallowRef<Settings>(DEFAULT_SETTINGS)
	let loaded: 'pending' | 'read' | 'failed' = 'pending'
	/** Whether the stored settings were read or could not be. */
	const settled = ref(false)
	let early: Partial<Settings> = {}

	api.loadSettings().then((stored) => {
		loaded = 'read'
		settled.value = true
		settings.value = { ...parseSettings(stored), ...early }
		if (Object.keys(early).length > 0) {
			save(early)
		}
	}).catch((error: unknown) => {
		loaded = 'failed'
		settled.value = true
		logger.error('Could not read the settings; the defaults apply.', { error })
		if (Object.keys(early).length > 0) {
			unsaved()
		}
	})

	/** Says that the settings last for this visit only. */
	function unsaved() {
		toast(t('honeycomb', 'Could not save the settings; they apply until you reload.'))
	}

	/** Saves each list the change touches, and the settings object when it touches another setting; a failed save keeps them for this visit. */
	function save(patch: Partial<Settings>) {
		const { object, lists } = splitChange(patch)
		const saves = lists.map((name) => api.saveSettingsList(name, settings.value[name]))
		for (const saving of object ? [...saves, api.saveSettings(storedSettings(settings.value))] : saves) {
			saving.catch((error: unknown) => {
				logger.error('Could not save the settings.', { error })
				unsaved()
			})
		}
	}

	/** Applies the change at once and saves it once the stored settings are read, never over ones that could not be. */
	function update(patch: Partial<Settings>) {
		settings.value = { ...settings.value, ...patch }
		if (loaded === 'read') {
			save(patch)
		} else if (loaded === 'pending') {
			early = { ...early, ...patch }
		} else {
			unsaved()
		}
	}

	return { settings, settled, update }
}
