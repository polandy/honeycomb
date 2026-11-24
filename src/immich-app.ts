// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { ImmichCullApi, ImmichCullContext } from './immich-cull.ts'
import type { ImmichApi } from './immich-source.ts'
import type { StoredImmichFilters } from './logic/immich-filter-storage.ts'
import type { ViewStateApi } from './view-state.ts'

import { computed, watch } from 'vue'
import { fireAndLog } from './fire-and-log.ts'
import { useImmichCull } from './immich-cull.ts'
import { useImmichSource } from './immich-source.ts'
import { formatCaptureDay } from './l10n.ts'
import { logger } from './logger.ts'
import { IMMICH_FILTERS_KEY, storedFiltersOf } from './logic/immich-filter-storage.ts'
import { browserCalendar } from './logic/immich-filters.ts'
import { immichOnlyOffer } from './logic/immich-only.ts'

/** The seams the app's Immich side is built from. */
export interface ImmichAppContext {
	readonly source: ImmichApi
	readonly cull: ImmichCullApi
	readonly storage: BrowserStorage
	/** Where each connection's filters are kept (ADR 0019). */
	readonly viewState: ViewStateApi
	readonly now: () => number
	readonly toast: ImmichCullContext['toast']
}

/** The app's Immich side: the source switcher, the opened connection's status and its cull (IMMICH-001, IMMICH-002). */
export function useImmichApp(context: ImmichAppContext) {
	const immich = useImmichSource(context.source, context.storage)
	const shown = computed(() => immich.source.value === 'immich')
	const opened = immich.connection
	const openedStatus = computed(() => opened.value && immich.statusOf(opened.value.id))
	const onlyOffer = computed(() => immichOnlyOffer(immich.availability.value, openedStatus.value))
	// The view state is read once per visit, so the filters written since overlay its answer.
	const written = new Map<string, StoredImmichFilters>()
	let opening = 0
	const cull = useImmichCull({ api: context.cull, now: context.now, calendar: browserCalendar, dayLabel: formatCaptureDay, toast: context.toast, saveFilters })
	// The pictures show once the shown connection answers ok, and start over whenever it opens again.
	watch(() => (shown.value && openedStatus.value?.state === 'ok' ? opened.value!.id : null), (id) => {
		opening += 1
		if (id !== null) {
			fireAndLog(openOnStoredFilters(id, opening), 'Could not open the Immich connection')
		}
	})

	/** Opens the cull on the connection's stored filters, unless another open came since (IMMICH-002.32). */
	async function openOnStoredFilters(id: string, asked: number) {
		const stored = await storedFilters(id)
		if (asked === opening) {
			cull.open(id, written.get(id) ?? stored)
		}
	}

	/** The connection's filters in the view state; `null`, so the defaults apply, when it cannot be read. */
	async function storedFilters(id: string): Promise<unknown> {
		try {
			return storedFiltersOf(await context.viewState.loadViewState(), id)
		} catch (error) {
			logger.error('Could not read the stored Immich filters; the defaults apply.', { error })
			return null
		}
	}

	/** Keeps the connection's filters for its next open. */
	function saveFilters(id: string, stored: StoredImmichFilters) {
		written.set(id, stored)
		fireAndLog(context.viewState.saveViewState({ [IMMICH_FILTERS_KEY]: { [id]: stored } }), 'Could not keep the Immich filters')
	}

	/** Opens the connection and asks its status again. */
	function openConnection(connectionId: string) {
		immich.open(connectionId)
		fireAndLog(immich.check(connectionId), 'Could not check the Immich connection')
	}

	/** Asks the opened connection's status again (IMMICH-001.19). */
	function checkOpened() {
		if (opened.value !== null) {
			fireAndLog(immich.check(opened.value.id), 'Could not check the Immich connection')
		}
	}
	// The folder picker offers *I only use Immich* by the status of the connection to open (IMMICH-001.21).
	fireAndLog(immich.load().then(checkOpened), 'Could not load the Immich connections')

	return { immich, shown, opened, openedStatus, onlyOffer, cull, openConnection, checkOpened }
}
