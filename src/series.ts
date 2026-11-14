// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { HashImage, SaveVisualHashes } from './visual-hashes.ts'

import { computed } from 'vue'
import { allSeries, findSeries, openSeries, seriesCandidates, seriesMembers, seriesSizes as sizesOf } from './logic/series.ts'
import { useVisualHashes } from './visual-hashes.ts'

/** The series of the cull's pictures and the visual hashes they are formed by. */
export function useSeries(api: { readonly hashImage: HashImage, readonly saveVisualHashes: SaveVisualHashes }, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision) {
	const hashes = useVisualHashes(api, storage, pictures)
	const candidates = computed(() => seriesCandidates(pictures(), hashes.hashOf))
	const everySeries = computed(() => allSeries(candidates.value, decisionOf, hashes.hashOf))
	const series = computed(() => findSeries(everySeries.value, decisionOf))
	return {
		series,
		seriesSizes: computed(() => sizesOf(series.value)),
		seriesOf: computed(() => seriesMembers(everySeries.value)),
		openSeries: computed(() => openSeries(series.value, (picture) => hashes.stateOf(picture) === 'pending')),
		holdHashes: hashes.hold,
		hashProgress: hashes.progress,
	}
}
