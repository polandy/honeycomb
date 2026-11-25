// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import SimilarityPage from '../components/SimilarityPage.vue'
import { imageUrl, listFolders, listMissingVisualHashes, loadSettings, saveVisualHashes } from '../api/index.ts'
import { waitSeconds } from '../logic/retry-after.ts'
import { parseSettings } from '../logic/settings.ts'
import { browserSchedule } from '../shared/browser-schedule.ts'
import { logger } from '../shared/logger.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { hashInWorkers } from './visual-hashes.ts'

const workers = browserHashWorkers()
const seams = {
	listMissing: listMissingVisualHashes,
	hash: hashInWorkers(workers, imageUrl),
	save: saveVisualHashes,
	wait: waitSeconds(browserSchedule),
	workers: workers.size,
}
const roots = parseSettings(await loadSettings()).libraryRoots
const app = createApp(SimilarityPage, { seams, listFolders, roots })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb similarity page', { error, info })
}
app.mount('#honeycomb-similarity')
