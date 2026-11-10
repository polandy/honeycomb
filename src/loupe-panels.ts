// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'

import { ref } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { INFO_PANEL, parsePanelWidth } from './logic/panel-width.ts'

export const INFO_OPEN_KEY = 'honeycomb.infoOpen'
export const INFO_WIDTH_KEY = 'honeycomb.infoWidth'
export const NAVIGATION_SHOWN_KEY = 'honeycomb.loupeNavigationShown'
export const GESTURE_GUIDE_SEEN_KEY = 'honeycomb.gestureGuideSeen'

/** The info panel's open state and width, whether Nextcloud's navigation shows and whether the gesture guide was seen, kept in the browser like the tile size. */
export function useLoupePanels(storage: BrowserStorage) {
	const infoOpen = ref(readStored(storage, INFO_OPEN_KEY) === 'true')
	const infoWidth = ref(parsePanelWidth(readStored(storage, INFO_WIDTH_KEY), INFO_PANEL))
	const navigationShown = ref(readStored(storage, NAVIGATION_SHOWN_KEY) === 'true')
	const gestureGuideSeen = ref(readStored(storage, GESTURE_GUIDE_SEEN_KEY) === 'true')

	return {
		infoOpen,
		infoWidth,
		navigationShown,
		gestureGuideSeen,
		setInfoOpen(open: boolean) {
			infoOpen.value = open
			writeStored(storage, INFO_OPEN_KEY, String(open))
		},
		setInfoWidth(width: number) {
			infoWidth.value = width
			writeStored(storage, INFO_WIDTH_KEY, String(width))
		},
		setNavigationShown(shown: boolean) {
			navigationShown.value = shown
			writeStored(storage, NAVIGATION_SHOWN_KEY, String(shown))
		},
		dismissGestureGuide() {
			gestureGuideSeen.value = true
			writeStored(storage, GESTURE_GUIDE_SEEN_KEY, 'true')
		},
	}
}
