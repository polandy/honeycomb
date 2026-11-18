// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'

import { mount } from '@vue/test-utils'
import SeriesCompare from '../../../src/components/SeriesCompare.vue'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { ActionsStub, DialogStub } from './stubs.ts'

/** Three photos of one folder, compared as one series. */
export const SERIES = picturesOf([
	listingEntry(1, '/Trip/IMG_1.JPG'),
	listingEntry(2, '/Trip/IMG_2.JPG'),
	listingEntry(3, '/Trip/IMG_3.JPG'),
]) as Picture<ListingEntry>[]

/** The compare on the series, second of four, its second photo active, measured at 1416 × 760. */
export function mountSeriesCompare(decisions: Record<string, Decision> = {}, series: Picture<ListingEntry>[] | null = SERIES, now = () => 0, oneSeries = false) {
	return mount(SeriesCompare, {
		attachTo: document.body,
		props: {
			now,
			oneSeries,
			series: series === null ? null : { key: 1, members: series },
			position: 1,
			count: 4,
			active: 1,
			decisionOf: (picture: Picture<ListingEntry>) => decisions[picture.baseName] ?? UNDECIDED,
			imageUrl: (fileId: number, size: number) => `/image/${fileId}/${size}`,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1416, 760)
				return () => undefined
			},
		},
		global: { stubs: { NcDialog: DialogStub, NcActions: ActionsStub } },
	})
}
