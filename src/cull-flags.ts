// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagApi, FlagItem } from './flags-api.ts'
import type { StoredDecision } from './logic/decision.ts'

import { logger } from './logger.ts'

/** The flag fields of a row, as the endpoints take them. */
const itemOf = ({ fileId, flag, keepRaw }: StoredDecision): FlagItem => ({ fileId, flag, keepRaw })

/** The cull's flag saves, one at a time in order, and the take-over of pictures seen for the first time (XMP-003.34, .38). */
export function useCullFlags(api: FlagApi) {
	let queue: Promise<unknown> = Promise.resolve()

	/** Saves the rows' flags after the saves before; answers the file ids not saved, every one when the save fails (XMP-008.17). */
	function save(rows: readonly StoredDecision[]): Promise<ReadonlySet<number>> {
		const items = rows.map(itemOf)
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

	/** Stores the rows where their files have no row yet; a failure is logged and changes nothing shown (XMP-003.36). */
	function takeOver(rows: readonly StoredDecision[]) {
		if (rows.length > 0) {
			api.takeOver(rows.map(itemOf)).catch((error: unknown) => logger.warn('Could not take the flags over; the photos show what their sidecars state', { error }))
		}
	}

	/** Waits for every save sent so far to answer (DELETE-002.28). */
	async function flush() {
		await queue
	}

	return { save, takeOver, flush }
}
