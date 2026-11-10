// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'

import { computed, shallowRef, watch } from 'vue'

/** What the series viewer reads from the cull and hands back on closing. */
export interface SeriesViewerContext<P> {
	readonly decisionOf: (picture: P) => Decision
	readonly closed: (shown: P) => void
}

/** The series viewer's state: the series it shows without its rejected pictures, and the shown one by identity (SERIES-002). */
export function useSeriesViewer<P>(context: SeriesViewerContext<P>) {
	const members = shallowRef<readonly P[]>([])
	const shown = shallowRef<P | null>(null)

	const pictures = computed(() => members.value.filter((picture) => context.decisionOf(picture).flag !== 'rejected'))
	const open = computed(() => shown.value !== null)
	const index = computed(() => (shown.value === null ? 0 : Math.max(0, pictures.value.indexOf(shown.value))))

	/** Opens the viewer on the picture at `at` of the series, the first one if `at` is outside it. */
	function openAt(series: readonly P[], at: number) {
		members.value = series
		shown.value = series[at] ?? series[0] ?? null
	}

	/** Shows the picture at `at`; ignored outside the shown pictures. */
	function go(at: number) {
		const picture = pictures.value[at]
		if (picture !== undefined && shown.value !== null) {
			shown.value = picture
		}
	}

	/** Closes the viewer, handing back the shown picture. */
	function close() {
		const picture = shown.value
		if (picture === null) {
			return
		}
		shown.value = null
		members.value = []
		context.closed(picture)
	}

	watch(pictures, (now, before) => {
		const picture = shown.value
		if (picture === null || !before.includes(picture)) {
			return
		}
		const back = now.find((each) => !before.includes(each))
		if (back !== undefined) {
			shown.value = back
		} else if (!now.includes(picture)) {
			shown.value = now[Math.min(before.indexOf(picture), now.length - 1)] ?? picture
		}
		if (now.length < 2) {
			close()
		}
	}, { flush: 'sync' })

	return { open, pictures, index, openAt, go, close }
}

export type SeriesViewerState<P> = ReturnType<typeof useSeriesViewer<P>>
