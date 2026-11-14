// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { ViewStateStore } from './view-state.ts'

import { ref } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { INFO_PANEL, parsePanelWidth } from './logic/panel-width.ts'

export const INFO_WIDTH_KEY = 'honeycomb.infoWidth'
export const NAVIGATION_SHOWN_KEY = 'honeycomb.loupeNavigationShown'

/** The loupe's panels: the info panel's width and whether Nextcloud's navigation shows depend on the screen and stay in the browser like the tile size; the open state, the gesture guide and the first-series hint come from the view state. */
export function useLoupePanels(storage: BrowserStorage, viewState: ViewStateStore) {
	const infoWidth = ref(parsePanelWidth(readStored(storage, INFO_WIDTH_KEY), INFO_PANEL))
	const navigationShown = ref(readStored(storage, NAVIGATION_SHOWN_KEY) === 'true')

	return {
		infoOpen: viewState.infoPanelOpen,
		infoWidth,
		navigationShown,
		gestureGuideSeen: viewState.gestureGuideSeen,
		setInfoOpen: viewState.setInfoPanelOpen,
		setInfoWidth(width: number) {
			infoWidth.value = width
			writeStored(storage, INFO_WIDTH_KEY, String(width))
		},
		setNavigationShown(shown: boolean) {
			navigationShown.value = shown
			writeStored(storage, NAVIGATION_SHOWN_KEY, String(shown))
		},
		dismissGestureGuide: viewState.dismissGestureGuide,
		seriesHintSeen: viewState.seriesHintSeen,
		dismissSeriesHint: viewState.dismissSeriesHint,
	}
}
