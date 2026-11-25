// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getFirstDay } from '@nextcloud/l10n'
import { createApp } from 'vue'
import StatisticsPage from '../components/StatisticsPage.vue'
import { listAllLibraryFolders, loadSettings, loadStatistics, saveViewState } from '../api/index.ts'
import { logger } from '../shared/logger.ts'

const app = createApp(StatisticsPage, { seams: { loadStatistics, loadLibraryFolders: listAllLibraryFolders, loadSettings, saveViewState, firstWeekDay: getFirstDay } })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb statistics page', { error, info })
}
app.mount('#honeycomb-statistics')
