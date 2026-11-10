// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Enters the browser's full screen with the element, or leaves it. */
export function toggleBrowserFullscreen(element: HTMLElement) {
	const change = document.fullscreenElement ? document.exitFullscreen() : element.requestFullscreen()
	change.catch(() => undefined)
}
