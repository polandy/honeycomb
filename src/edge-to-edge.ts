// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

const FIT = /\s*,?\s*viewport-fit\s*=\s*[^,]*/g

/** Adds `viewport-fit=cover` to the page's viewport, so the safe-area insets report the cutouts (APP-001.21). */
export function optInToEdgeToEdge(doc: Document): void {
	let meta = doc.head.querySelector('meta[name="viewport"]')
	if (meta === null) {
		meta = doc.createElement('meta')
		meta.setAttribute('name', 'viewport')
		meta.setAttribute('content', 'width=device-width')
		doc.head.append(meta)
	}
	const content = (meta.getAttribute('content') ?? '').replace(FIT, '')
	meta.setAttribute('content', `${content}, viewport-fit=cover`)
}
