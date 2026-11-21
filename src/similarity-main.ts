// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import SimilarityPage from './components/SimilarityPage.vue'
import { imageUrl, listFolders, listMissingVisualHashes, saveVisualHashes } from './api.ts'
import { browserSchedule } from './browser-schedule.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { logger } from './logger.ts'
import { waitSeconds } from './logic/retry-after.ts'
import { hashInWorkers } from './visual-hashes.ts'

const workers = browserHashWorkers()
const seams = {
	listMissing: listMissingVisualHashes,
	hash: hashInWorkers(workers, imageUrl),
	save: saveVisualHashes,
	wait: waitSeconds(browserSchedule),
	workers: workers.size,
}
const app = createApp(SimilarityPage, { seams, listFolders })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb similarity page', { error, info })
}
app.mount('#honeycomb-similarity')
