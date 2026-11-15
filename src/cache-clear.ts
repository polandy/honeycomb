// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@nextcloud/l10n'
import { logger } from './logger.ts'

/** Clears the cache and tells the user how it went (SETTINGS-001.25). */
export async function clearCacheWithToast(clear: () => Promise<void>, toast: (message: string) => void): Promise<void> {
	try {
		await clear()
		toast(t('honeycomb', 'Cache cleared'))
	} catch (error) {
		logger.error('Could not clear the cache.', { error })
		toast(t('honeycomb', 'Could not clear the cache.'))
	}
}
