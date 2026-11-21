// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { ImmichCullApi, ImmichCullContext } from './immich-cull.ts'
import type { ImmichApi } from './immich-source.ts'

import { computed, watch } from 'vue'
import { useImmichCull } from './immich-cull.ts'
import { useImmichSource } from './immich-source.ts'
import { formatCaptureDay } from './l10n.ts'
import { browserCalendar } from './logic/immich-filters.ts'

/** The seams the app's Immich side is built from. */
export interface ImmichAppContext {
	readonly source: ImmichApi
	readonly cull: ImmichCullApi
	readonly storage: BrowserStorage
	readonly now: () => number
	readonly toast: ImmichCullContext['toast']
}

/** The app's Immich side: the source switcher, the opened connection's status and its cull (IMMICH-001, IMMICH-002). */
export function useImmichApp(context: ImmichAppContext) {
	const immich = useImmichSource(context.source, context.storage)
	void immich.load()
	const shown = computed(() => immich.source.value === 'immich')
	const opened = immich.connection
	const openedStatus = computed(() => opened.value && immich.statusOf(opened.value.id))
	const cull = useImmichCull({ api: context.cull, now: context.now, calendar: browserCalendar, dayLabel: formatCaptureDay, toast: context.toast })
	// The pictures show once the connection answers ok, and start over whenever it opens again.
	watch(() => (openedStatus.value?.state === 'ok' ? opened.value!.id : null), (id) => id !== null && cull.open(id))

	/** Opens the connection and asks its status again. */
	function openConnection(connectionId: string) {
		immich.open(connectionId)
		void immich.check(connectionId)
	}

	/** Asks the opened connection's status again (IMMICH-001.19). */
	function checkOpened() {
		if (opened.value !== null) {
			void immich.check(opened.value.id)
		}
	}

	return { immich, shown, opened, openedStatus, cull, openConnection, checkOpened }
}
