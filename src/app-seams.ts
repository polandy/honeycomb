// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder } from './api.ts'
import type { BrowserStorage } from './browser-storage.ts'
import type { CullTagsApi } from './cull-tags.ts'
import type { ListEntries } from './folder-count.ts'
import type { LegacyApi } from './legacy.ts'
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

import { listEntries as apiListEntries, listFolders as apiListFolders, loadSettings as apiLoadSettings, lookupDecisions as apiLookupDecisions, saveDecisions as apiSaveDecisions, saveSettings as apiSaveSettings, trashPictures as apiTrashPictures, warmPreviews as apiWarmPreviews, imageUrl, loadPositions, loadTagList, loadViewState, lookupEmbeddedXmp, lookupSidecars, lookupTags, movePictures, probeTargets, savePosition, saveSidecars, saveTags, saveViewState, saveVisualHashes } from './api.ts'
import { toggleBrowserFullscreen } from './fullscreen.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { acknowledgeLegacy, loadLegacyExport, loadLegacyInventory } from './legacy-api.ts'
import { onBrowserPageHide } from './page-hide.ts'
import { saveBrowserFile } from './save-file.ts'
import { lookupSeries, saveSeries } from './series-api.ts'
import { browserNow } from './sidecar-flow.ts'
import { browserSchedule } from './tile-selection.ts'
import { hashInWorkers } from './visual-hashes.ts'
import { clearCache } from './xmp-cache-api.ts'

/** The server and browser seams of the app; tests replace them with fakes. */
export interface AppSeams {
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: WarmPreviews
	hashImage?: HashImage
	saveVisualHashes?: SaveVisualHashes
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	saveDecisions?: (decisions: readonly StoredDecision[]) => Promise<void>
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
	legacy?: LegacyApi
	saveFile?: (name: string, text: string) => void
	/** Whether the Versions app is enabled for the user, which writing to sidecars needs (SETTINGS-001.26). */
	versionsApp?: boolean
}

/** The seams the app uses in production. */
export const APP_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	hashImage: hashInWorkers(browserHashWorkers(), imageUrl),
	saveVisualHashes,
	lookupDecisions: apiLookupDecisions,
	saveDecisions: apiSaveDecisions,
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
	sidecars: () => ({ lookupSidecars, lookupEmbeddedXmp, saveSidecars, now: browserNow }),
	move: () => ({ probeTargets, movePictures }),
	tags: () => ({ lookupTags, saveTags, loadTagList }),
	clearCache,
	legacy: () => ({ loadInventory: loadLegacyInventory, loadExport: loadLegacyExport, acknowledge: acknowledgeLegacy }),
	saveFile: () => saveBrowserFile,
	versionsApp: true,
}
