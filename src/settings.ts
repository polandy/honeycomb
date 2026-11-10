// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings } from './logic/settings.ts'

import { t } from '@nextcloud/l10n'
import { shallowRef } from 'vue'
import { logger } from './logger.ts'
import { DEFAULT_SETTINGS, parseSettings } from './logic/settings.ts'

/** The server seams of the settings (ADR 0014). */
export interface SettingsApi {
	loadSettings(): Promise<unknown>
	saveSettings(settings: Settings): Promise<void>
}

/** The user's settings: the defaults until the stored ones arrive, each change applied at once and saved whole. */
export function useSettings(api: SettingsApi, toast: (message: string) => void) {
	const settings = shallowRef<Settings>(DEFAULT_SETTINGS)
	let loaded: 'pending' | 'read' | 'failed' = 'pending'
	let early: Partial<Settings> = {}

	api.loadSettings().then((stored) => {
		loaded = 'read'
		settings.value = { ...parseSettings(stored), ...early }
		if (Object.keys(early).length > 0) {
			save()
		}
	}).catch((error: unknown) => {
		loaded = 'failed'
		logger.error('Could not read the settings; the defaults apply.', { error })
		if (Object.keys(early).length > 0) {
			unsaved()
		}
	})

	/** Says that the settings last for this visit only. */
	function unsaved() {
		toast(t('honeycomb', 'Could not save the settings; they apply until you reload.'))
	}

	/** Saves the whole settings; a failed save keeps them for this visit. */
	function save() {
		api.saveSettings(settings.value).catch((error: unknown) => {
			logger.error('Could not save the settings.', { error })
			unsaved()
		})
	}

	/** Applies the change at once and saves it once the stored settings are read, never over ones that could not be. */
	function update(patch: Partial<Settings>) {
		settings.value = { ...settings.value, ...patch }
		if (loaded === 'read') {
			save()
		} else if (loaded === 'pending') {
			early = { ...early, ...patch }
		} else {
			unsaved()
		}
	}

	return { settings, update }
}
