// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder, PairingExtensions } from './api.ts'
import type { BrowserStorage } from './browser-storage.ts'
import type { LocationApi } from './cull-location.ts'
import type { CullTagsApi } from './cull-tags.ts'
import type { FlagApi } from './flags-api.ts'
import type { ListEntries } from './folder-count.ts'
import type { ImmichCullApi } from './immich-cull.ts'
import type { ImmichApi } from './immich-source.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Settings } from './logic/settings.ts'
import type { TrashExpectation, TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'
import type { MoveApi } from './move-flow-context.ts'
import type { OnPageHide } from './page-hide.ts'
import type { WarmPreviews } from './preview-warmer.ts'
import type { MeasureImage, SaveQualityValues } from './quality-values.ts'
import type { ResumeApi } from './resume.ts'
import type { SidecarFlowApi } from './sidecar-flow.ts'
import type { LookupSeries, SaveSeries } from './stored-series.ts'
import type { ViewStateApi } from './view-state.ts'
import type { HashImage, SaveVisualHashes } from './visual-hashes.ts'

import { listEntries as apiListEntries, listFolders as apiListFolders, loadSettings as apiLoadSettings, saveSettings as apiSaveSettings, trashPictures as apiTrashPictures, warmPreviews as apiWarmPreviews, cleanUpOrphanedData, imageUrl, immichAssets, immichCounts, immichImageUrl, immichStatus, listImmichConnections, loadPositions, loadTagList, loadViewState, lookupEmbeddedXmp, lookupSidecars, movePictures, probeTargets, resetStatistics, saveImmichDecisions, savePosition, saveQualityValues, saveSidecars, saveViewState, saveVisualHashes } from './api.ts'
import { browserSchedule } from './browser-schedule.ts'
import { browserLocation } from './cull-location.ts'
import { saveFlags, takeOverFlags } from './flags-api.ts'
import { toggleBrowserFullscreen } from './fullscreen.ts'
import { browserHashWorkers } from './hash-workers.ts'
import { onBrowserPageHide } from './page-hide.ts'
import { measureInWorkers } from './quality-values.ts'
import { lookupSeries, saveSeries } from './series-api.ts'
import { browserNow } from './sidecar-flow.ts'
import { hashInWorkers } from './visual-hashes.ts'
import { clearCache, lookupXmpCache, saveXmpCache } from './xmp-cache-api.ts'
import { browserDay } from './year-review-hint.ts'

const MS_PER_SECOND = 1000

/** The element the server renders the app into, which carries its data attributes. */
const APP_ELEMENT = 'honeycomb'

/** The server and browser seams of the app; tests replace them with fakes. */
export interface AppSeams {
	listFolders?: (path: string, extensions?: PairingExtensions) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: WarmPreviews
	/** The URL of a preview tier, which the grid, the loupe and the series compare load. */
	imageUrl?: ImageUrlFor
	hashImage?: HashImage
	saveVisualHashes?: SaveVisualHashes
	measureImage?: MeasureImage
	saveQualityValues?: SaveQualityValues
	flags?: FlagApi
	lookupSeries?: LookupSeries
	saveSeries?: SaveSeries
	loadSettings?: () => Promise<unknown>
	saveSettings?: (settings: Settings) => Promise<void>
	viewState?: ViewStateApi
	positions?: ResumeApi
	/** The page address, which keeps the folder and the picture across a browser reload. */
	location?: LocationApi
	storage?: BrowserStorage
	schedule?: Schedule
	/** Writes the waiting sidecars when the page hides (XMP-003.29). */
	onPageHide?: OnPageHide
	toggleFullscreen?: (element: HTMLElement) => void
	trashPictures?: (pictures: readonly (readonly TrashRequestFile[])[], expect?: TrashExpectation | null) => Promise<TrashResponseFile[][]>
	sidecars?: SidecarFlowApi
	move?: MoveApi
	tags?: CullTagsApi
	/** The user's Immich connections and their status (IMMICH-001). */
	immich?: ImmichApi
	/** An Immich connection's pages, counts, decisions and images (IMMICH-002, IMMICH-003). */
	immichCull?: ImmichCullApi
	clearCache?: () => Promise<void>
	/** Whether the user is an admin, who may clean up the orphaned data (SETTINGS-001.27). */
	admin?: () => boolean
	cleanUp?: () => Promise<number>
	resetStatistics?: () => Promise<void>
	/** A monotonic clock in ms, which active time is measured by (STATS-001.35). */
	clock?: () => number
	/** The browser's local day as YYYY-MM-DD, which the year-in-review hint shows by (STATS-001.26). */
	today?: () => string
	/** The wall clock in Unix seconds, which the Immich time filter counts from (IMMICH-002.11). */
	now?: () => number
}

/** The page's one pool of workers, which hashes and measures (SERIES-006.15). */
const HASH_WORKERS = browserHashWorkers()

/** The seams the app uses in production. */
export const APP_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	imageUrl,
	hashImage: hashInWorkers(HASH_WORKERS, imageUrl),
	saveVisualHashes,
	measureImage: measureInWorkers(HASH_WORKERS, imageUrl),
	saveQualityValues,
	flags: () => ({ save: saveFlags, takeOver: takeOverFlags }),
	lookupSeries,
	saveSeries,
	loadSettings: apiLoadSettings,
	saveSettings: apiSaveSettings,
	viewState: () => ({ loadViewState, saveViewState }),
	positions: () => ({ loadPositions, savePosition }),
	location: () => browserLocation,
	storage: () => window.localStorage,
	schedule: browserSchedule,
	onPageHide: onBrowserPageHide,
	toggleFullscreen: toggleBrowserFullscreen,
	trashPictures: apiTrashPictures,
	sidecars: () => ({ lookupSidecars, lookupEmbeddedXmp, saveSidecars, lookupXmpCache, saveXmpCache, now: browserNow }),
	move: () => ({ probeTargets, movePictures }),
	tags: () => ({ loadTagList }),
	immich: () => ({ listConnections: listImmichConnections, status: immichStatus }),
	immichCull: () => ({ assets: immichAssets, counts: immichCounts, saveDecisions: saveImmichDecisions, imageUrl: immichImageUrl }),
	clearCache,
	admin: () => document.getElementById(APP_ELEMENT)?.dataset.admin === 'true',
	cleanUp: cleanUpOrphanedData,
	resetStatistics,
	clock: () => performance.now(),
	today: browserDay,
	now: () => Date.now() / MS_PER_SECOND,
}
