// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Stops `page` scrolling until every lock taken on it is released; returns the release, which acts once. */
export function lockScroll(page: HTMLElement): () => void {
	const locks = Number(page.dataset.scrollLocks ?? 0)
	if (locks === 0) {
		page.dataset.scrollOverflow = page.style.overflow
		page.style.overflow = 'hidden'
	}
	page.dataset.scrollLocks = String(locks + 1)
	let released = false
	return () => {
		if (released) {
			return
		}
		released = true
		const left = Number(page.dataset.scrollLocks) - 1
		if (left > 0) {
			page.dataset.scrollLocks = String(left)
			return
		}
		page.style.overflow = page.dataset.scrollOverflow ?? ''
		delete page.dataset.scrollLocks
		delete page.dataset.scrollOverflow
	}
}
