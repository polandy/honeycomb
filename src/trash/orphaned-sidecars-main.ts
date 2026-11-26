// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import OrphanedSidecarsPage from '../components/OrphanedSidecarsPage.vue'
import { listFolders, listOrphanedSidecars, trashOrphanedSidecars } from '../api/index.ts'
import { loadLibraryRoots } from '../api/library-roots.ts'
import { browserPageNavigation } from '../components/page-navigation-browser.ts'
import { logger } from '../shared/logger.ts'

const roots = await loadLibraryRoots()
const app = createApp(OrphanedSidecarsPage, { seams: { scan: listOrphanedSidecars, trash: trashOrphanedSidecars }, listFolders, roots, navigation: browserPageNavigation })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb orphaned sidecars page', { error, info })
}
app.mount('#honeycomb-orphaned-sidecars')
