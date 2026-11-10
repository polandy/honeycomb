// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Reports an element's content size now and on every change; returns the stop function. */
export type ObserveSize = (element: Element, onSize: (width: number, height: number) => void) => () => void

/** Observes the element's content size with a ResizeObserver. */
export const observeElementSize: ObserveSize = (element, onSize) => {
	const observer = new ResizeObserver(([entry]) => entry && onSize(entry.contentRect.width, entry.contentRect.height))
	observer.observe(element)
	return () => observer.disconnect()
}
