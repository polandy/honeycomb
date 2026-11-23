// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { OrphanedSidecar, OrphanedSidecarAnswer, OrphanedSidecarPage, OrphanedSidecarReport } from './logic/orphaned-sidecars.ts'

import { computed, ref, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { groupByFolder, moveReport } from './logic/orphaned-sidecars.ts'
import { CHUNK_LIMITS } from './logic/request-chunks.ts'

/** How many sidecars one trash request carries at most, the server's limit (XMP-009). */
export const ORPHANED_SIDECARS_TRASH_BATCH = CHUNK_LIMITS.files

/** What the page needs from the server. */
export interface OrphanedSidecarSeams {
	readonly scan: (path: string, cursor: string) => Promise<OrphanedSidecarPage>
	readonly trash: (sidecars: readonly Pick<OrphanedSidecar, 'fileId' | 'etag'>[]) => Promise<OrphanedSidecarAnswer[]>
}

/** Where the page stands: nothing listed, scanning, a list waiting for the confirmation, moving, or moved. */
export type OrphanedSidecarStatus = 'idle' | 'scanning' | 'found' | 'moving' | 'done'

/** Scans a folder for orphaned sidecars and moves the found list to the trash bin only when asked (XMP-009). */
export function useOrphanedSidecars(seams: OrphanedSidecarSeams) {
	const status = ref<OrphanedSidecarStatus>('idle')
	const problem = ref<'scan' | 'trash' | null>(null)
	const found = shallowRef<OrphanedSidecar[]>([])
	const report = shallowRef<OrphanedSidecarReport | null>(null)
	let run = 0

	/** Forgets the list, and the pages of a scan still under way. */
	function drop() {
		run++
		status.value = 'idle'
		problem.value = null
		found.value = []
		report.value = null
	}

	/** Lists every orphaned sidecar below `path`, page after page; a new scan or a drop ends it. */
	async function scan(path: string) {
		drop()
		const own = run
		status.value = 'scanning'
		const sidecars: OrphanedSidecar[] = []
		let cursor: string | null = ''
		try {
			while (cursor !== null) {
				const page: OrphanedSidecarPage = await seams.scan(path, cursor)
				if (own !== run) {
					return
				}
				sidecars.push(...page.sidecars)
				cursor = page.nextCursor
			}
		} catch (error) {
			if (own === run) {
				logger.error('Could not look for orphaned sidecars.', { error })
				status.value = 'idle'
				problem.value = 'scan'
			}
			return
		}
		found.value = sidecars
		status.value = 'found'
	}

	/** Moves the found list to the trash bin in batches; a failed request stops it (XMP-009.12). */
	async function move() {
		if (status.value !== 'found') {
			return
		}
		status.value = 'moving'
		const sent = found.value
		const answers: OrphanedSidecarAnswer[] = []
		for (let start = 0; start < sent.length; start += ORPHANED_SIDECARS_TRASH_BATCH) {
			try {
				answers.push(...await seams.trash(sent.slice(start, start + ORPHANED_SIDECARS_TRASH_BATCH).map(({ fileId, etag }) => ({ fileId, etag }))))
			} catch (error) {
				logger.error('Could not move orphaned sidecars to the trash bin.', { error })
				problem.value = 'trash'
				break
			}
		}
		report.value = moveReport(sent, answers)
		found.value = []
		status.value = 'done'
	}

	return { status, problem, list: computed(() => groupByFolder(found.value)), report, scan, move, drop }
}
