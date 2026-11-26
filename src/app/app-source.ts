import type { RecentOpener } from '../folders/recent.ts'
import type { NavigationTarget } from '../logic/cull-location.ts'
import type { FolderSet } from '../logic/folder-set.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { ResumePosition } from '../logic/resume-position.ts'
import type { ListedAccess } from '../logic/writability.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { LocationApi } from '../shared/browser-location.ts'

import { parseTarget } from '../logic/cull-location.ts'
import { useCullLocation } from '../shared/browser-location.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'

/** What opening a folder set uses of the cull, the *Recent* list and the resume flow. */
export interface FolderSetOpeningCull {
	readonly folderSet: () => FolderSet | null
	/** The file the loupe shows, null while it is closed. */
	readonly shownFileId: () => PictureId | null
	readonly open: (set: FolderSet, entries: ListingEntry[], access: ListedAccess) => void
	/** Lists the folder set, opens its cull and then calls `opened`. */
	readonly list: (set: FolderSet, openCull: RecentOpener['open'], opened: () => void) => Promise<void>
	readonly openPosition: (position: ResumePosition, opener: RecentOpener) => Promise<void>
	readonly offer: () => void
	readonly resumeAt: (fileId: PictureId) => void
	readonly resume: () => void
	/** Closes the folder picker and the folders home before the loupe resumes. */
	readonly leave: () => void
	/** Opens what a page of its own asked for in the address (APP-001.26). */
	readonly choose: (target: NavigationTarget) => void
}

/** Opens folder sets: confirmed, listed again, from *Recent* and from the page address. */
export function useFolderSetOpening(location: LocationApi, cull: FolderSetOpeningCull) {
	/** Opens the confirmed folder set and offers its resume position. */
	function openFolderSet(set: FolderSet, entries: ListingEntry[], access: ListedAccess) {
		cull.open(set, entries, access)
		cull.offer()
	}

	/** Lists the folder set and opens it, the loupe at the picture when one is given and still there (DECISIONS-002.17, .18). */
	async function openAt(set: FolderSet, fileId: PictureId | null) {
		await cull.list(set, fileId === null ? openFolderSet : cull.open, () => fileId !== null && cull.resumeAt(fileId))
	}

	/** Lists the open folder set again, keeping the loupe's picture (DECISIONS-002.18). */
	function reload() {
		const open = cull.folderSet()
		if (open !== null) {
			fireAndLog(openAt(open, cull.shownFileId()), 'Could not open the picture of the address')
		}
	}

	/** Opens a folder set under *Recent* at its resume position. */
	function openRecent(position: ResumePosition) {
		fireAndLog(cull.openPosition(position, { open: cull.open, resumeAt: cull.resumeAt, resumeOpen: () => {
			cull.leave()
			cull.resume()
		} }), 'Could not open the recent folder set')
	}

	const target = parseTarget(location.read())
	if (target !== null) {
		cull.choose(target)
	}
	useCullLocation(location, { folderSet: cull.folderSet, shownFileId: cull.shownFileId }, ({ folderSet, fileId }) => openAt(folderSet, fileId))

	return { openFolderSet, openAt, reload, openRecent }
}
