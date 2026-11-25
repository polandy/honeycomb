// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Folder, PairingExtensions } from '../api/index.ts'
import type { LocationApi } from '../cull/cull-location.ts'
import type { ListEntries } from '../folders/folder-count.ts'
import type { FolderDoneApi } from '../folders/folder-done.ts'
import type { LibraryApi } from '../folders/folders.ts'
import type { ResumeApi } from '../folders/resume.ts'
import type { ImmichCullApi } from '../immich/immich-picture-source.ts'
import type { ImmichApi } from '../immich/immich-source.ts'

import { listEntries as apiListEntries, listFolders as apiListFolders, immichAssets, immichCounts, immichImageUrl, immichStatus, listImmichConnections, listLibraryFolders, loadPositions, markFolderDone, reopenFolder, saveImmichDecisions, savePosition, scanLibrary } from '../api/index.ts'
import { browserLocation } from '../cull/cull-location.ts'

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
}

/** The source seams the app uses in production. */
export const SOURCE_SEAMS = {
	listFolders: apiListFolders,
	listEntries: apiListEntries,
	positions: () => ({ loadPositions, savePosition }),
	library: () => ({ listLibraryFolders, scanLibrary, markFolderDone, reopenFolder }),
	location: () => browserLocation,
	immich: () => ({ listConnections: listImmichConnections, status: immichStatus }),
	immichCull: () => ({ assets: immichAssets, counts: immichCounts, saveDecisions: saveImmichDecisions, imageUrl: immichImageUrl }),
}
