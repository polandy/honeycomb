// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { onBeforeUnmount, onMounted, ref } from 'vue'

type WebkitDocument = Document & {
	webkitFullscreenEnabled?: boolean
	webkitFullscreenElement?: Element | null
	webkitExitFullscreen?: () => Promise<void> | void
}
type WebkitElement = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void }

const CHANGE_EVENTS = ['fullscreenchange', 'webkitfullscreenchange']

/** Whether the browser can show an element full screen; iPhone Safari cannot. */
export function fullscreenAvailable(): boolean {
	return Boolean(document.fullscreenEnabled || (document as WebkitDocument).webkitFullscreenEnabled)
}

/** Whether an element is full screen now. */
function fullscreenActive(): boolean {
	return Boolean(document.fullscreenElement || (document as WebkitDocument).webkitFullscreenElement)
}

/** Enters the browser's full screen with the element, or leaves it. */
export function toggleBrowserFullscreen(element: HTMLElement) {
	const doc = document as WebkitDocument
	const enter = () => element.requestFullscreen ? element.requestFullscreen() : (element as WebkitElement).webkitRequestFullscreen?.()
	const leave = () => doc.exitFullscreen ? doc.exitFullscreen() : doc.webkitExitFullscreen?.()
	Promise.resolve(fullscreenActive() ? leave() : enter()).catch(() => undefined)
}

/** Tells whether full screen is available and on, following the browser, also when Escape leaves it. */
export function useFullscreenState() {
	const available = fullscreenAvailable()
	const active = ref(fullscreenActive())
	const update = () => {
		active.value = fullscreenActive()
	}
	onMounted(() => CHANGE_EVENTS.forEach((name) => document.addEventListener(name, update)))
	onBeforeUnmount(() => CHANGE_EVENTS.forEach((name) => document.removeEventListener(name, update)))
	return { available, active }
}
