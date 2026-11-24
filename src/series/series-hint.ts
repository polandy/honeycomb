// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'

import { computed } from 'vue'

/** The view state the first-series hint reads and writes. */
export interface SeriesHintState {
	gestureGuideSeen: Readonly<Ref<boolean>>
	seriesHintSeen: Readonly<Ref<boolean>>
	dismissSeriesHint(): void
}

/** The first-series hint (LOUPE-001.26): it waits for the gesture guide and shows at a picture of a series until it is dismissed for good. */
export function useSeriesHint(state: SeriesHintState, inSeries: () => boolean) {
	const shown = computed(() => state.gestureGuideSeen.value && !state.seriesHintSeen.value && inSeries())
	return {
		shown,
		/** Dismisses the hint for good while it shows; using what it tells counts too. */
		dismiss() {
			if (shown.value) {
				state.dismissSeriesHint()
			}
		},
	}
}
