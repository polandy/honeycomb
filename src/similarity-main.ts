// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import SimilarityPage from './components/SimilarityPage.vue'
import { imageUrl, listFolders, listMissingVisualHashes, saveVisualHashes } from './api.ts'
import { createHashWorkers } from './hash-workers.ts'
import { logger } from './logger.ts'
import { hashWorkerCount } from './logic/hash-workers.ts'
import { smallSource } from './logic/image-tiers.ts'

const count = hashWorkerCount(navigator.hardwareConcurrency)
const workers = createHashWorkers(count, () => new Worker(new URL('./hash-worker.ts', import.meta.url), { type: 'module' }))
const seams = {
	listMissing: listMissingVisualHashes,
	hash: (picture: { fileId: number, mtime: number }) => workers.hash(smallSource(picture, imageUrl)),
	save: saveVisualHashes,
	workers: count,
}
const app = createApp(SimilarityPage, { seams, listFolders })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb similarity page', { error, info })
}
app.mount('#honeycomb-similarity')
