// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import OrphanedSidecarsPage from '../components/OrphanedSidecarsPage.vue'
import { listFolders, listOrphanedSidecars, loadSettings, trashOrphanedSidecars } from '../api/index.ts'
import { parseSettings } from '../logic/settings.ts'
import { logger } from '../shared/logger.ts'

const roots = parseSettings(await loadSettings()).libraryRoots
const app = createApp(OrphanedSidecarsPage, { seams: { scan: listOrphanedSidecars, trash: trashOrphanedSidecars }, listFolders, roots })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb orphaned sidecars page', { error, info })
}
app.mount('#honeycomb-orphaned-sidecars')
