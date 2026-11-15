// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import SimilarityPage from './components/SimilarityPage.vue'
import { imageUrl, listFolders, listMissingVisualHashes, saveVisualHashes } from './api.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { logger } from './logger.ts'
import { smallSource } from './logic/image-tiers.ts'

/** Converts the seconds a limited save waits for the timer. */
const MILLISECONDS_PER_SECOND = 1000

const workers = browserHashWorkers()
const seams = {
	listMissing: listMissingVisualHashes,
	hash: (picture: { fileId: number, mtime: number }) => workers.hash(smallSource(picture, imageUrl)),
	save: saveVisualHashes,
	wait: (seconds: number) => new Promise<void>((resume) => setTimeout(resume, seconds * MILLISECONDS_PER_SECOND)),
	workers: workers.size,
}
const app = createApp(SimilarityPage, { seams, listFolders })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb similarity page', { error, info })
}
app.mount('#honeycomb-similarity')
