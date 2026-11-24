// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListEntries } from './folder-count.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { ResumePosition } from './logic/resume-position.ts'
import type { ListedAccess } from './logic/writability.ts'
import type { ResumeApi } from './resume.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, shallowRef } from 'vue'
import { fireAndLog } from './fire-and-log.ts'
import { listFolderSet } from './folder-count.ts'
import { logger } from './logger.ts'
import { countFolderSet } from './logic/cull.ts'
import { folderSetKey } from './logic/folder-set.ts'
import { recentFolderSets, withPosition } from './logic/recent.ts'
import { parsePositions, positionOf } from './logic/resume-position.ts'
import { notOpenedText } from './recent-text.ts'

/** What *Recent* reads from the open cull. */
export interface RecentCull {
	readonly folderSet: () => FolderSet | null
	readonly progress: () => { decided: number, total: number }
	readonly pairing: () => PairingSettings
}

/** How a folder set under *Recent* opens; apart from `RecentCull`, since it needs the resume flow. */
export interface RecentOpener {
	/** Opens the folder set's cull. */
	readonly open: (set: FolderSet, entries: ListingEntry[], access: ListedAccess) => void
	/** Opens the loupe of the cull just opened at the file. */
	readonly resumeAt: (fileId: PictureId) => void
	/** Opens the loupe of the open cull at its resume position. */
	readonly resumeOpen: () => void
}

/** The folder sets under *Recent* and how one opens at its position (DECISIONS-002.8). */
export function useRecent(api: ResumeApi, listEntries: ListEntries, cull: RecentCull, toast: (message: string, action: ToastAction) => void) {
	const positions = shallowRef<ResumePosition[]>([])
	let reading = 0
	let opening = 0
	/** Whether a folder set from *Recent* is being listed (GRID-001.13). */
	const listing = ref(false)

	/** Reads the stored positions again; a failed read keeps the list. */
	function refresh() {
		const read = ++reading
		api.loadPositions().then((answer) => {
			if (read === reading) {
				positions.value = parsePositions(answer)
			}
		}).catch((error: unknown) => logger.error('Could not read the recent folder sets', { error }))
	}

	/** Lists the folder set and opens it at its position; the open one resumes in place. */
	async function open({ folderSet, fileId }: ResumePosition, opener: RecentOpener) {
		const current = cull.folderSet()
		if (current !== null && folderSetKey(current) === folderSetKey(folderSet)) {
			opener.resumeOpen()
			return
		}
		await list(folderSet, opener.open, () => opener.resumeAt(fileId))
	}

	/** Lists the folder set and opens its cull without a position; the open one stays (XMP-007.10). */
	async function openSet(folderSet: FolderSet, openCull: RecentOpener['open']) {
		const current = cull.folderSet()
		if (current === null || folderSetKey(current) !== folderSetKey(folderSet)) {
			await list(folderSet, openCull, () => {})
		}
	}

	/** Lists the folder set and opens its cull, unless another was chosen meanwhile; a failure keeps the cull. */
	async function list(folderSet: FolderSet, openCull: RecentOpener['open'], opened: () => void) {
		const listed = ++opening
		listing.value = true
		try {
			const listings = await listFolderSet(folderSet, listEntries)
			if (listed === opening) {
				const { entries, access } = countFolderSet(listings, cull.pairing())
				openCull(folderSet, entries, access)
				opened()
			}
		} catch (error) {
			logger.error('Could not list the recent folder set', { error })
			toast(notOpenedText(folderSet, error), { label: t('honeycomb', 'Try again'), run: () => fireAndLog(list(folderSet, openCull, opened), 'Could not list the folder set again') })
		} finally {
			if (listed === opening) {
				listing.value = false
			}
		}
	}

	return {
		items: computed(() => recentFolderSets(positions.value, cull.folderSet(), cull.progress())),
		refresh,
		open,
		openSet,
		list,
		listing,
		/** The stored position of the folder set, or null. */
		positionOf: (folderSet: FolderSet) => positionOf(positions.value, folderSet),
		/** The positions API for the resume flow; a saved position is listed first. */
		positions: {
			loadPositions: () => api.loadPositions(),
			savePosition: async (position: ResumePosition, activeSeconds: number) => {
				await api.savePosition(position, activeSeconds)
				reading++
				positions.value = withPosition(positions.value, position)
			},
		} satisfies ResumeApi,
	}
}
