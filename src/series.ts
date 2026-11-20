// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { Decision } from './logic/decision.ts'
import type { ListingEntry, SourceEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { StoredRows } from './logic/stored-series.ts'
import type { QualityApi } from './quality-values.ts'
import type { VisualHashApi } from './visual-hashes.ts'

import { computed } from 'vue'
import { imageMember } from './logic/image-tiers.ts'
import { isListingPicture } from './logic/listing.ts'
import { allSeries, findSeries, openSeries, seriesCandidates, seriesMembers } from './logic/series.ts'
import { splitByStoredRows } from './logic/stored-series.ts'
import { useQualityValues } from './quality-values.ts'
import { useVisualHashes } from './visual-hashes.ts'

/** The series of the cull's pictures, stored and automatic, the visual hashes the automatic ones are formed by and their members' quality values. */
export function useSeries(api: VisualHashApi & QualityApi, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, storedRows: () => StoredRows) {
	const hashes = useVisualHashes(api, storage, pictures)
	const split = computed(() => splitByStoredRows(pictures(), storedRows()))
	const candidates = computed(() => seriesCandidates(split.value.loose, hashes.hashOf))
	const everySeries = computed(() => allSeries(candidates.value, decisionOf, hashes.hashOf, split.value.stored))
	const series = computed(() => findSeries(everySeries.value, decisionOf))
	const quality = useQualityValues(api, () => everySeries.value.flatMap(({ members }) => members.map(imageMember)), () => !hashes.pending.value)
	return {
		series,
		everySeries,
		seriesOf: computed(() => seriesMembers(everySeries.value)),
		openSeries: computed(() => openSeries(everySeries.value, (picture) => hashes.stateOf(picture) === 'pending')),
		holdHashes: hashes.hold,
		hashProgress: hashes.progress,
		/** The quality value of the picture's shown member, or null while it has none (SERIES-006). */
		qualityOf: (picture: Picture<SourceEntry>) => (isListingPicture(picture) ? quality.qualityOf(imageMember(picture)) : null),
	}
}
