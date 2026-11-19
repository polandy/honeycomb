// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { n, t } from '@nextcloud/l10n'
import { logger } from './logger.ts'

/** Clears the cache and tells the user how it went (SETTINGS-001.25). */
export async function clearCacheWithToast(clear: () => Promise<void>, toast: (message: string) => void, fail: (message: string) => void): Promise<void> {
	try {
		await clear()
		toast(t('honeycomb', 'Cache cleared'))
	} catch (error) {
		logger.error('Could not clear the cache.', { error })
		fail(t('honeycomb', 'Could not clear the cache.'))
	}
}

/** Cleans up the orphaned data and tells the admin how much went (SETTINGS-001.27). */
export async function cleanUpWithToast(cleanUp: () => Promise<number>, toast: (message: string) => void, fail: (message: string) => void): Promise<void> {
	try {
		const removed = await cleanUp()
		toast(removed === 0 ? t('honeycomb', 'Nothing was orphaned') : n('honeycomb', 'Removed %n orphaned entry', 'Removed %n orphaned entries', removed))
	} catch (error) {
		logger.error('Could not clean up the orphaned data.', { error })
		fail(t('honeycomb', 'Could not clean up the orphaned data.'))
	}
}
