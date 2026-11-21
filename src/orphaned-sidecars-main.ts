// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import OrphanedSidecarsPage from './components/OrphanedSidecarsPage.vue'
import { listFolders, listOrphanedSidecars, trashOrphanedSidecars } from './api.ts'
import { logger } from './logger.ts'

const app = createApp(OrphanedSidecarsPage, { seams: { scan: listOrphanedSidecars, trash: trashOrphanedSidecars }, listFolders })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb orphaned sidecars page', { error, info })
}
app.mount('#honeycomb-orphaned-sidecars')
