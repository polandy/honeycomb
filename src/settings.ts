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
	let changed = false

	api.loadSettings().then((stored) => {
		if (!changed) {
			settings.value = parseSettings(stored)
		}
	}).catch((error: unknown) => {
		logger.error('Could not read the settings; the defaults apply.', { error })
	})

	/** Applies the change at once and saves the whole settings; a failed save keeps it for this visit. */
	function update(patch: Partial<Settings>) {
		changed = true
		settings.value = { ...settings.value, ...patch }
		api.saveSettings(settings.value).catch((error: unknown) => {
			logger.error('Could not save the settings.', { error })
			toast(t('honeycomb', 'Could not save the settings; they apply until you reload.'))
		})
	}

	return { settings, update }
}
