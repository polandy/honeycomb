// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Runs `run` each time the page turns hidden or is left, until the returned stop is called. */
export type OnPageHide = (run: () => void) => () => void

/** The browser's page hiding: the tab turning hidden, or the page being left (ADR 0032). */
export const onBrowserPageHide: OnPageHide = (run) => {
	const hidden = () => {
		if (document.visibilityState === 'hidden') {
			run()
		}
	}
	document.addEventListener('visibilitychange', hidden)
	window.addEventListener('pagehide', run)
	return () => {
		document.removeEventListener('visibilitychange', hidden)
		window.removeEventListener('pagehide', run)
	}
}
