// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder } from './api.ts'
import type { BrowserStorage } from './browser-storage.ts'
import type { ListEntries } from './folder-count.ts'
import type { StoredDecision } from './logic/decision.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Settings } from './logic/settings.ts'
import type { TrashRequestFile, TrashResponseFile } from './logic/trash-report.ts'
import type { MoveApi } from './move-flow.ts'
import type { ResumeApi } from './resume.ts'
import type { SidecarFlowApi } from './sidecar-flow.ts'
import type { ViewStateApi } from './view-state.ts'
import type { HashImage } from './visual-hashes.ts'

import { listEntries as apiListEntries, listFolders as apiListFolders, loadSettings as apiLoadSettings, lookupDecisions as apiLookupDecisions, saveDecisions as apiSaveDecisions, saveSettings as apiSaveSettings, trashPictures as apiTrashPictures, warmPreviews as apiWarmPreviews, imageUrl, loadPositions, loadViewState, lookupSidecars, movePictures, probeTargets, savePosition, saveSidecars, saveViewState } from './api.ts'
import { toggleBrowserFullscreen } from './fullscreen.ts'
import { browserNow } from './sidecar-flow.ts'
import { browserSchedule } from './tile-selection.ts'
import { hashPreview } from './visual-hashes.ts'

/** The server and browser seams of the app; tests replace them with fakes. */
export interface AppSeams {
	listFolders?: (path: string) => Promise<Folder[]>
	listEntries?: ListEntries
	warmPreviews?: (fileIds: readonly number[]) => Promise<void>
	hashImage?: HashImage
	lookupDecisions?: (fileIds: readonly number[]) => Promise<StoredDecision[]>
	saveDecisions?: (decisions: readonly StoredDecision[]) => Promise<void>
	loadSettings?: () => Promise<unknown>
	saveSettings?: (settings: Settings) => Promise<void>
	viewState?: ViewStateApi
	positions?: ResumeApi
	storage?: BrowserStorage
	schedule?: Schedule
	toggleFullscreen?: (element: HTMLElement) => void
	trashPictures?: (pictures: readonly (readonly TrashRequestFile[])[]) => Promise<TrashResponseFile[][]>
	sidecars?: SidecarFlowApi
	move?: MoveApi
}

/** The seams the app uses in production. */
export const APP_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	warmPreviews: apiWarmPreviews,
	hashImage: hashPreview(imageUrl),
	lookupDecisions: apiLookupDecisions,
	saveDecisions: apiSaveDecisions,
	loadSettings: apiLoadSettings,
	saveSettings: apiSaveSettings,
	viewState: () => ({ loadViewState, saveViewState }),
	positions: () => ({ loadPositions, savePosition }),
	storage: () => () => window.localStorage,
	schedule: browserSchedule,
	toggleFullscreen: toggleBrowserFullscreen,
	trashPictures: apiTrashPictures,
	sidecars: () => ({ lookupSidecars, saveSidecars, now: browserNow }),
	move: () => ({ probeTargets, movePictures }),
}
