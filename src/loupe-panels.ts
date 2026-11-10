// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'

import { ref } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { INFO_PANEL, parsePanelWidth } from './logic/panel-width.ts'

export const INFO_OPEN_KEY = 'honeycomb.infoOpen'
export const INFO_WIDTH_KEY = 'honeycomb.infoWidth'
export const NAVIGATION_SHOWN_KEY = 'honeycomb.loupeNavigationShown'

/** The info panel's open state and width and whether Nextcloud's navigation shows, kept in the browser like the tile size. */
export function useLoupePanels(storage: BrowserStorage) {
	const infoOpen = ref(readStored(storage, INFO_OPEN_KEY) === 'true')
	const infoWidth = ref(parsePanelWidth(readStored(storage, INFO_WIDTH_KEY), INFO_PANEL))
	const navigationShown = ref(readStored(storage, NAVIGATION_SHOWN_KEY) === 'true')

	return {
		infoOpen,
		infoWidth,
		navigationShown,
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
	}
}
