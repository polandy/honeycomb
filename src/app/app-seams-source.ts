// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder, PairingExtensions } from '../api/index.ts'
import type { ListEntries } from '../folders/folder-count.ts'
import type { FolderDoneApi } from '../folders/folder-done.ts'
import type { LibraryApi } from '../folders/folders.ts'
import type { ResumeApi } from '../folders/resume.ts'
import type { ImmichCullApi } from '../immich/immich-picture-source.ts'
import type { ImmichPositionApi } from '../immich/immich-resume.ts'
import type { ImmichApi } from '../immich/immich-source.ts'
import type { ImmichWriteApi } from '../immich/immich-write.ts'
import type { LocationApi } from '../shared/browser-location.ts'

import { listEntries as apiListEntries, listFolders as apiListFolders, checkLibraryRoot, immichAssets, immichCounts, immichImageUrl, immichStatus, immichWrite, immichWriteCandidates, immichWriteCheck, listImmichConnections, listLibraryFolders, loadPositions, markFolderDone, markFoldersDone, reopenFolder, reopenFolders, saveImmichDecisions, saveImmichPosition, savePosition, scanLibrary } from '../api/index.ts'
import { browserLocation } from '../shared/browser-location.ts'

/** The seams of the sources: the folders, the library, *Recent*, the page address and Immich. */
export interface SourceSeams {
	listFolders?: (path: string, extensions?: PairingExtensions) => Promise<Folder[]>
	listEntries?: ListEntries
	positions?: ResumeApi
	/** The library roots' folder list (FOLDERS-005). */
	library?: LibraryApi & FolderDoneApi
	/** The page address, which keeps the folder and the picture across a browser reload. */
	location?: LocationApi
	/** The user's Immich connections and their status (IMMICH-001). */
	immich?: ImmichApi
	/** An Immich connection's pages, counts, decisions and images (IMMICH-002, IMMICH-003). */
	immichCull?: ImmichCullApi
	/** Where the connections' positions are read and saved (IMMICH-003.14). */
	immichPositions?: ImmichPositionApi
	/** What *Write to Immich* checks and writes (IMMICH-004). */
	immichWrite?: ImmichWriteApi
}

/** The source seams the app uses in production. */
export const SOURCE_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	positions: () => ({ loadPositions, savePosition }),
	library: () => ({ listLibraryFolders, checkLibraryRoot, scanLibrary, markFolderDone, reopenFolder, markFoldersDone, reopenFolders }),
	location: () => browserLocation,
	immich: () => ({ listConnections: listImmichConnections, status: immichStatus }),
	immichCull: () => ({ assets: immichAssets, counts: immichCounts, saveDecisions: saveImmichDecisions, imageUrl: immichImageUrl }),
	immichPositions: () => ({ loadPositions, savePosition: saveImmichPosition }),
	immichWrite: () => ({ candidates: immichWriteCandidates, check: immichWriteCheck, write: immichWrite, imageUrl: immichImageUrl }),
}
