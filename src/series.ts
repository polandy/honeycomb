// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { StoredRows } from './logic/stored-series.ts'
import type { VisualHashApi } from './visual-hashes.ts'

import { computed } from 'vue'
import { allSeries, findSeries, openSeries, seriesCandidates, seriesMembers, seriesSizes as sizesOf } from './logic/series.ts'
import { splitByStoredRows } from './logic/stored-series.ts'
import { useVisualHashes } from './visual-hashes.ts'

/** The series of the cull's pictures, stored and automatic, and the visual hashes the automatic ones are formed by. */
export function useSeries(api: VisualHashApi, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, storedRows: () => StoredRows) {
	const hashes = useVisualHashes(api, storage, pictures)
	const split = computed(() => splitByStoredRows(pictures(), storedRows()))
	const candidates = computed(() => seriesCandidates(split.value.loose, hashes.hashOf))
	const everySeries = computed(() => allSeries(candidates.value, decisionOf, hashes.hashOf, split.value.stored))
	const series = computed(() => findSeries(everySeries.value, decisionOf))
	return {
		series,
		everySeries,
		seriesSizes: computed(() => sizesOf(series.value)),
		seriesOf: computed(() => seriesMembers(everySeries.value)),
		openSeries: computed(() => openSeries(series.value, (picture) => hashes.stateOf(picture) === 'pending')),
		holdHashes: hashes.hold,
		hashProgress: hashes.progress,
	}
}
