// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { StoredViewState, ViewState, ViewStateKey } from './logic/view-state.ts'

import { computed, ref } from 'vue'
import { readStored, removeStored } from './browser-storage.ts'
import { logger } from './logger.ts'
import { DEFAULT_VIEW_STATE, NOTHING_STORED, parseLocalValue, parseViewState, planViewState } from './logic/view-state.ts'

/** Where versions before ADR 0019 kept the view state in browser storage. */
export const INFO_OPEN_KEY = 'honeycomb.infoOpen'
export const GESTURE_GUIDE_SEEN_KEY = 'honeycomb.gestureGuideSeen'
const LOCAL_KEYS: Record<ViewStateKey, string> = { infoPanelOpen: INFO_OPEN_KEY, gestureGuideSeen: GESTURE_GUIDE_SEEN_KEY }

/** The server seams of the view state (ADR 0019). */
export interface ViewStateApi {
	loadViewState(): Promise<unknown>
	saveViewState(patch: Partial<ViewState>): Promise<void>
}

/** The loupe's view state: read once, each change applied at once and written key by key; values left in browser storage are taken over once. */
export function useViewState(api: ViewStateApi, storage: BrowserStorage) {
	const loaded = ref(false)
	const state = ref<ViewState>({ ...DEFAULT_VIEW_STATE })
	const changed = new Set<ViewStateKey>()
	const local: StoredViewState = { ...NOTHING_STORED }
	for (const [key, name] of Object.entries(LOCAL_KEYS) as [ViewStateKey, string][]) {
		local[key] = parseLocalValue(readStored(storage, name))
	}

	/** Removes the local leftovers of `keys`. */
	const removeLocal = (keys: readonly ViewStateKey[]) => keys.forEach((key) => removeStored(storage, LOCAL_KEYS[key]))

	api.loadViewState().then((answer) => {
		const plan = planViewState(parseViewState(answer), local, changed)
		state.value = { ...state.value, ...plan.apply }
		removeLocal(plan.remove)
		if (Object.keys(plan.upload).length > 0) {
			api.saveViewState(plan.upload)
				.then(() => removeLocal(Object.keys(plan.upload) as ViewStateKey[]))
				.catch((error: unknown) => logger.error('Could not take over the view state from the browser.', { error }))
		}
	}).catch((error: unknown) => {
		logger.error('Could not read the view state; the values in the browser apply.', { error })
		state.value = { ...state.value, ...planViewState(NOTHING_STORED, local, changed).apply }
	}).finally(() => {
		loaded.value = true
	})

	/** Applies the change at once and writes only its key; a failed write keeps it for this visit. */
	function change(patch: Partial<ViewState>) {
		Object.keys(patch).forEach((key) => changed.add(key as ViewStateKey))
		state.value = { ...state.value, ...patch }
		api.saveViewState(patch).catch((error: unknown) => logger.error('Could not save the view state.', { error }))
	}

	return {
		infoPanelOpen: computed(() => state.value.infoPanelOpen),
		/** Seen until the view state is read, so the gesture guide never flashes. */
		gestureGuideSeen: computed(() => !loaded.value || state.value.gestureGuideSeen),
		setInfoPanelOpen: (open: boolean) => change({ infoPanelOpen: open }),
		dismissGestureGuide: () => change({ gestureGuideSeen: true }),
		showGestureGuide: () => change({ gestureGuideSeen: false }),
	}
}

export type ViewStateStore = ReturnType<typeof useViewState>
