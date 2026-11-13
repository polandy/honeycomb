// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The side of a filmstrip photo in CSS pixels; the strip is as high. */
export const FILMSTRIP_THUMB = 56

/** How many photos the filmstrip renders beyond each end of its view, so a scroll shows no gap. */
export const FILMSTRIP_OVERSCAN = 4

/** Where the filmstrip stands: the shown picture, the picture count, the strip's width and its scroll offset. */
export interface FilmstripView {
	readonly index: number
	readonly count: number
	readonly viewport: number
	readonly offset: number
}

/** The filmstrip's geometry: the scroll width, the offset that brings the shown picture as near the middle as the strip's ends allow, and the photos to render, `first` up to but not including `end`. */
export interface FilmstripLayout {
	readonly width: number
	readonly centred: number
	readonly first: number
	readonly end: number
}

/** Lays the photos edge to edge from the strip's left edge; the strip scrolls the shown one to the middle but never past either end. */
export function filmstripLayout({ index, count, viewport, offset }: FilmstripView): FilmstripLayout {
	const width = count * FILMSTRIP_THUMB
	if (viewport <= 0) {
		return { width, centred: 0, first: 0, end: 0 }
	}
	const middle = index * FILMSTRIP_THUMB + FILMSTRIP_THUMB / 2 - viewport / 2
	const centred = Math.min(Math.max(0, width - viewport), Math.max(0, middle))
	const end = Math.min(count, Math.ceil((offset + viewport) / FILMSTRIP_THUMB) + FILMSTRIP_OVERSCAN)
	const first = Math.min(end, Math.max(0, Math.floor(offset / FILMSTRIP_THUMB) - FILMSTRIP_OVERSCAN))
	return { width, centred, first, end }
}
