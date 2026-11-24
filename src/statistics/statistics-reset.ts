// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { t } from '@nextcloud/l10n'
import { logger } from '../shared/logger.ts'

/** Resets the statistics and tells the user how it went (STATS-001.3). */
export async function resetStatisticsWithToast(reset: () => Promise<void>, toast: (message: string) => void, fail: (message: string) => void): Promise<void> {
	try {
		await reset()
		toast(t('honeycomb', 'Statistics reset'))
	} catch (error) {
		logger.error('Could not reset the statistics.', { error })
		fail(t('honeycomb', 'Could not reset the statistics.'))
	}
}
