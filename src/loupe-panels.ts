// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'

import { ref } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { INFO_PANEL, parsePanelWidth } from './logic/panel-width.ts'

export const INFO_OPEN_KEY = 'honeycomb.infoOpen'
export const INFO_WIDTH_KEY = 'honeycomb.infoWidth'

/** The info panel's open state and width, kept in the browser like the tile size. */
export function useLoupePanels(storage: BrowserStorage) {
	const infoOpen = ref(readStored(storage, INFO_OPEN_KEY) === 'true')
	const infoWidth = ref(parsePanelWidth(readStored(storage, INFO_WIDTH_KEY), INFO_PANEL))

	return {
		infoOpen,
		infoWidth,
		setInfoOpen(open: boolean) {
			infoOpen.value = open
			writeStored(storage, INFO_OPEN_KEY, String(open))
		},
		setInfoWidth(width: number) {
			infoWidth.value = width
			writeStored(storage, INFO_WIDTH_KEY, String(width))
		},
	}
}
