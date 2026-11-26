// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import StatisticsPage from '../components/StatisticsPage.vue'
import { listAllLibraryFolders, loadSettings, loadStatistics, saveViewState } from '../api/index.ts'
import { browserPageNavigation } from '../components/page-navigation-browser.ts'
import { logger } from '../shared/logger.ts'

const app = createApp(StatisticsPage, { seams: { loadStatistics, loadLibraryFolders: listAllLibraryFolders, loadSettings, saveViewState }, navigation: browserPageNavigation })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb statistics page', { error, info })
}
app.mount('#honeycomb-statistics')
