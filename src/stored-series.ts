// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SeriesLookup } from './logic/stored-series.ts'

import { shallowRef } from 'vue'
import { logger } from './logger.ts'
import { memberIds } from './logic/pairing.ts'
import { NO_STORED_ROWS, withLookup } from './logic/stored-series.ts'

/** The series lookup endpoint (ADR 0027). */
export type LookupSeries = (fileIds: readonly number[]) => Promise<SeriesLookup>

/** The stored series rows of the open cull (SERIES-005); `current` names the open cull, answers for another are dropped. */
export function useStoredSeries(lookupSeries: LookupSeries, current: () => unknown) {
	const rows = shallowRef(NO_STORED_ROWS)

	/** Forgets the rows of the cull before. */
	function reset() {
		rows.value = NO_STORED_ROWS
	}

	/** Reads the rows of the files under those known, unless another cull opened meanwhile. */
	async function read(fileIds: readonly number[], failure: string) {
		const cull = current()
		try {
			const answer = await lookupSeries(fileIds)
			if (current() === cull) {
				rows.value = withLookup(rows.value, answer)
			}
		} catch (error) {
			logger.error(failure, { error })
		}
	}

	/** Reads the rows of every member of the opened pictures; a failed read leaves every series automatic (SERIES-005.26). */
	function load(opened: readonly Picture<ListingEntry>[]) {
		void read(opened.flatMap(memberIds), 'Could not read the stored series; every series shows as automatic')
	}

	/** Reads the rows of files put back that it holds none of. */
	function restore(fileIds: readonly number[]) {
		const unknown = fileIds.filter((fileId) => !rows.value.has(fileId))
		if (unknown.length > 0) {
			void read(unknown, 'Could not read the stored series of the photos moved back')
		}
	}

	return { rows, reset, load, restore }
}
