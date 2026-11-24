import type { StoredDecision } from '../logic/decision.ts'
import type { PictureId } from '../logic/picture-id.ts'
import type { SidecarEtagItem } from '../logic/sidecar-etags.ts'
import type { StatsCounts } from '../logic/stats-counts.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagApi, FlagItem } from './flags-api.ts'

import { logger } from '../shared/logger.ts'

/** The flag fields of a row, as the endpoints take them. */
const itemOf = ({ fileId, flag, keepRaw }: StoredDecision): FlagItem => ({ fileId, flag, keepRaw })

/** The cull's flag saves and sidecar ETag records, one at a time in order, and the take-over of pictures seen for the first time (XMP-003.34, .38, .45). */
export function useCullFlags(api: FlagApi) {
	let queue: Promise<unknown> = Promise.resolve()
	const etags = new Map<PictureId, string | null>()

	/** Saves the rows' flags, each with its counts by file id, after the saves before; answers the file ids not saved, every one when the save fails (XMP-008.17, STATS-001). */
	function save(rows: readonly StoredDecision[], counts: ReadonlyMap<PictureId, StatsCounts> = new Map()): Promise<ReadonlySet<PictureId>> {
		const items = rows.map((row) => {
			const own = counts.get(row.fileId)
			return own === undefined ? itemOf(row) : { ...itemOf(row), counts: own }
		})
		const saved = queue.then(() => api.save(items)).then(({ skipped }) => {
			if (skipped.length > 0) {
				logger.warn('The server did not save some flags; they are taken back', { skipped })
			}
			return new Set(skipped.map(({ fileId }) => fileId))
		}, (error: unknown) => {
			logger.error('Could not save the flags; they are taken back', { error })
			return new Set(items.map(({ fileId }) => fileId))
		})
		queue = saved
		return saved
	}

	/** Stores the rows where their files have no row yet, each with its sidecar's ETag when known; a failure is logged and changes nothing shown (XMP-003.36, DECISIONS-001.41). */
	function takeOver(rows: readonly StoredDecision[], sidecarEtags: ReadonlyMap<PictureId, string> = new Map()) {
		if (rows.length > 0) {
			sidecarEtags.forEach((etag, fileId) => etags.set(fileId, etag))
			api.takeOver(rows.map((row) => {
				const sidecarEtag = sidecarEtags.get(row.fileId)
				return sidecarEtag === undefined ? itemOf(row) : { ...itemOf(row), sidecarEtag }
			})).catch((error: unknown) => logger.warn('Could not take the flags over; the photos show what their sidecars state', { error }))
		}
	}

	/** Records the sidecar ETags on their rows after the saves before, and keeps them for the session; a failure is only logged (XMP-003.45, .46). */
	function record(items: readonly SidecarEtagItem[]) {
		if (items.length === 0) {
			return
		}
		items.forEach(({ fileId, sidecarEtag }) => etags.set(fileId, sidecarEtag))
		queue = queue.then(() => api.saveSidecarEtags(items)).then(({ skipped }) => {
			if (skipped.length > 0) {
				logger.warn('The server did not record some sidecar ETags', { skipped })
			}
		}, (error: unknown) => logger.warn('Could not record the sidecar ETags; the next visit compares the old ones', { error }))
	}

	/** The sidecar ETags recorded in this session, by file id. */
	function knownEtags(): ReadonlyMap<PictureId, string | null> {
		return etags
	}

	/** Waits for every save sent so far to answer (DELETE-002.28). */
	async function flush() {
		await queue
	}

	return { save, takeOver, record, knownEtags, flush }
}
