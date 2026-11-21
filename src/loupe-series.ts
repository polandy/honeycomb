// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SourceEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { Series } from './logic/series.ts'
import type { QualityOf } from './quality-of.ts'

import { computed } from 'vue'
import { sharpnessPlace } from './logic/sharpness.ts'
import { sharpestPicture, sharpnessBy } from './quality-of.ts'

type Shown = Picture<SourceEntry>

/** What the loupe's series actions read and ask for. */
export interface LoupeSeriesTargets {
	pictures: () => readonly Shown[]
	picture: () => Shown
	seriesOf: () => ReadonlyMap<Shown, Series<Shown>>
	qualityOf: QualityOf
	/** Dismisses the first-series hint, as using what it tells does. */
	dismissHint: () => void
	compare: (series: Series<Shown>, picture: Shown) => void
	pickRest: (series: Series<Shown>, picture: Shown) => void
}

/** The series of the shown picture and the loupe's actions on a series (LOUPE-001.19, LOUPE-001.25, LOUPE-002.15). */
export function useLoupeSeries(targets: LoupeSeriesTargets) {
	const series = computed(() => targets.seriesOf().get(targets.picture()) ?? null)
	const place = computed(() => (series.value === null ? null : { position: series.value.members.indexOf(targets.picture()) + 1, count: series.value.members.length }))

	return {
		series,
		/** The shown picture's position within its series, or null outside one. */
		place,
		/** The shown picture's rank by sharpness within its series, or null (SERIES-007.5). */
		sharpness: computed(() => (series.value === null ? null : sharpnessPlace(series.value.members, targets.picture(), sharpnessBy(targets.qualityOf)))),
		/** The sharpest picture of each series (SERIES-007.4). */
		sharpest: computed(() => new Set([...new Set(targets.seriesOf().values())].map(({ members }) => sharpestPicture(members, targets.qualityOf)).filter((found) => found !== null))),
		/** Opens the compare on the series of the picture at `index`, the shown picture active while it is in it, else that one. */
		compareAt(index: number) {
			const at = targets.pictures()[index]!
			const found = targets.seriesOf().get(at)
			if (found !== undefined) {
				targets.dismissHint()
				targets.compare(found, found.members.includes(targets.picture()) ? targets.picture() : at)
			}
		},
		/** Asks to pick the shown picture and reject the rest of its series, if it is in one. */
		pickRest() {
			if (series.value !== null) {
				targets.dismissHint()
				targets.pickRest(series.value, targets.picture())
			}
		},
	}
}
