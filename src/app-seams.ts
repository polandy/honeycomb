// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder } from './api.ts'
import type { BrowserStorage } from './browser-storage.ts'
import type { CullTagsApi } from './cull-tags.ts'
import type { ListEntries } from './folder-count.ts'
import type { StoredDecision } from './logic/decision.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Settings } from './logic/settings.ts'
import type { TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'
import type { MoveApi } from './move-flow.ts'
import type { OnPageHide } from './page-hide.ts'
import type { WarmPreviews } from './preview-warmer.ts'
import type { ResumeApi } from './resume.ts'
import type { SidecarFlowApi } from './sidecar-flow.ts'
import type { LookupSeries, SaveSeries } from './stored-series.ts'
import type { ViewStateApi } from './view-state.ts'
import type { HashImage, SaveVisualHashes } from './visual-hashes.ts'

import { listEntries as apiListEntries, listFolders as apiListFolders, loadSettings as apiLoadSettings, saveSettings as apiSaveSettings, trashPictures as apiTrashPictures, warmPreviews as apiWarmPreviews, cleanUpOrphanedData, imageUrl, loadPositions, loadTagList, loadViewState, lookupEmbeddedXmp, lookupSidecars, movePictures, probeTargets, savePosition, saveSidecars, saveViewState, saveVisualHashes } from './api.ts'
import { toggleBrowserFullscreen } from './fullscreen.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { onBrowserPageHide } from './page-hide.ts'
import { lookupSeries, saveSeries } from './series-api.ts'
import { browserNow } from './sidecar-flow.ts'
import { browserSchedule } from './tile-selection.ts'
import { hashInWorkers } from './visual-hashes.ts'
import { clearCache, lookupXmpCache, saveXmpCache } from './xmp-cache-api.ts'

/** The element the server renders the app into, which carries its data attributes. */
const APP_ELEMENT = 'honeycomb'

/** The server and browser seams of the app; tests replace them with fakes. */
export interface AppSeams {
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: WarmPreviews
	hashImage?: HashImage
	saveVisualHashes?: SaveVisualHashes
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	lookupSeries?: LookupSeries
	saveSeries?: SaveSeries
	loadSettings?: () => Promise<unknown>
	saveSettings?: (settings: Settings) => Promise<void>
	viewState?: ViewStateApi
	positions?: ResumeApi
	storage?: BrowserStorage
	schedule?: Schedule
	/** Writes the waiting sidecars when the page hides (XMP-003.29). */
	onPageHide?: OnPageHide
	toggleFullscreen?: (element: HTMLElement) => void
	trashPictures?: (pictures: readonly (readonly TrashRequestFile[])[]) => Promise<TrashResponseFile[][]>
	sidecars?: SidecarFlowApi
	move?: MoveApi
	tags?: CullTagsApi
	clearCache?: () => Promise<void>
	/** Whether the user is an admin, who may clean up the orphaned data (SETTINGS-001.27). */
	admin?: () => boolean
	cleanUp?: () => Promise<number>
}

/** The seams the app uses in production. */
export const APP_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	hashImage: hashInWorkers(browserHashWorkers(), imageUrl),
	saveVisualHashes,
	lookupDecisions: async (): Promise<StoredDecision[]> => [],
	lookupSeries,
	saveSeries,
	loadSettings: apiLoadSettings,
	saveSettings: apiSaveSettings,
	viewState: () => ({ loadViewState, saveViewState }),
	positions: () => ({ loadPositions, savePosition }),
	storage: () => window.localStorage,
	schedule: browserSchedule,
	onPageHide: onBrowserPageHide,
	toggleFullscreen: toggleBrowserFullscreen,
	trashPictures: apiTrashPictures,
	sidecars: () => ({ lookupSidecars, lookupEmbeddedXmp, saveSidecars, lookupXmpCache, saveXmpCache, now: browserNow }),
	move: () => ({ probeTargets, movePictures }),
	tags: () => ({ loadTagList }),
	clearCache,
	admin: () => document.getElementById(APP_ELEMENT)?.dataset.admin === 'true',
	cleanUp: cleanUpOrphanedData,
}
