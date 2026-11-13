// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'

import { emit, subscribe, unsubscribe } from '@nextcloud/event-bus'
import { useIsMobile } from '@nextcloud/vue/composables/useIsMobile'
import { onBeforeUnmount, onMounted } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { startsOpen } from './logic/navigation.ts'

export const NAVIGATION_OPEN_KEY = 'honeycomb.navigationOpen'

declare module '@nextcloud/event-bus' {
	interface NextcloudEvents {
		/** What NcAppNavigation reports after it opened or closed. */
		'navigation-toggled': { open: boolean }
	}
}

/** Starts Nextcloud's navigation as the user left it, else closed on a narrower screen, and remembers each toggle while it sits beside the page. */
export function useNavigationChoice(storage: BrowserStorage, viewportWidth: () => number) {
	const isMobile = useIsMobile()
	let docked = !isMobile.value
	let known = false

	/** Tells the navigation how to start. */
	function applyStart() {
		known = startsOpen(readStored(storage, NAVIGATION_OPEN_KEY), viewportWidth())
		emit('toggle-navigation', { open: known })
	}

	/** Remembers a toggle beside the page; a report of the known state is the echo of our own. */
	function remember({ open }: { open: boolean }) {
		if (docked === isMobile.value) {
			docked = !isMobile.value
			if (docked) {
				applyStart()
			}
		} else if (docked && open !== known) {
			known = open
			writeStored(storage, NAVIGATION_OPEN_KEY, String(open))
		}
	}

	onMounted(() => {
		if (docked) {
			applyStart()
		}
		subscribe('navigation-toggled', remember)
	})
	onBeforeUnmount(() => unsubscribe('navigation-toggled', remember))
}
