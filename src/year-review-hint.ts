// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ViewStateApi } from './view-state.ts'

import { computed, ref } from 'vue'
import { logger } from './logger.ts'
import { hintYear, parseClosedYear, reviewYear } from './logic/year-review.ts'

/** The browser's local day as YYYY-MM-DD. */
export function browserDay(): string {
	const now = new Date()
	return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-')
}

/** The year-in-review hint of the navigation (STATS-001.26): read once, it shows for a year not yet closed and stores the year when it is. */
export function useYearReviewHint(api: ViewStateApi, today: () => string) {
	const closed = ref<number | null>(null)
	const loaded = ref(false)

	api.loadViewState().then((answer) => {
		closed.value = parseClosedYear(answer)
		loaded.value = true
	}).catch((error: unknown) => logger.error('Could not read the closed year-in-review hint.', { error }))

	const year = computed(() => (loaded.value ? hintYear(today(), closed.value) : null))

	return {
		year,
		/** Hides the hint at once and stores its year; a failed write keeps it away for this visit. */
		close() {
			const shown = reviewYear(today())
			if (!loaded.value || shown === null) {
				return
			}
			closed.value = shown
			api.saveViewState({ yearReviewHintClosed: shown }).catch((error: unknown) => logger.error('Could not save the closed year-in-review hint.', { error }))
		},
	}
}
