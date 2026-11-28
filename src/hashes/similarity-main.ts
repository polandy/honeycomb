// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { createApp } from 'vue'
import SimilarityPage from '../components/SimilarityPage.vue'
import { imageUrl, listEntries, listFolders, listMissingVisualHashes, loadSettings, saveQualityValues, saveVisualHashes } from '../api/index.ts'
import { loadLibraryRoots } from '../api/library-roots.ts'
import { browserPageNavigation } from '../components/page-navigation-browser.ts'
import { waitSeconds } from '../logic/retry-after.ts'
import { pairingSettings, parseSettings } from '../logic/settings.ts'
import { browserSchedule } from '../shared/browser-schedule.ts'
import { logger } from '../shared/logger.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { measureInWorkers } from './quality-values.ts'
import { hashInWorkers } from './visual-hashes.ts'

const workers = browserHashWorkers()
const seams = {
	listMissing: listMissingVisualHashes,
	hash: hashInWorkers(workers, imageUrl),
	save: saveVisualHashes,
	wait: waitSeconds(browserSchedule),
	workers: workers.size,
}
const sharpness = {
	listTree: async (path: string) => (await listEntries(path, true)).entries,
	pairing: async () => pairingSettings(parseSettings(await loadSettings())),
	measureImage: measureInWorkers(workers, imageUrl),
	saveQualityValues,
	wait: waitSeconds(browserSchedule),
}
const roots = await loadLibraryRoots()
const app = createApp(SimilarityPage, { seams, sharpness, listFolders, roots, navigation: browserPageNavigation })
app.config.errorHandler = (error, _instance, info) => {
	logger.error('Unhandled error in the honeycomb similarity page', { error, info })
}
app.mount('#honeycomb-similarity')
