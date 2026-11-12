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

/** The filmstrip's geometry: the padding before the first photo, the scroll width, the offset that centres the shown picture, and the photos to render, `first` up to but not including `end`. */
export interface FilmstripLayout {
	readonly edge: number
	readonly width: number
	readonly centred: number
	readonly first: number
	readonly end: number
}

/** Lays the photos edge to edge after half the strip, so every one, the first and last too, can sit in the middle. */
export function filmstripLayout({ index, count, viewport, offset }: FilmstripView): FilmstripLayout {
	const edge = Math.max(0, viewport / 2 - FILMSTRIP_THUMB / 2)
	const width = count * FILMSTRIP_THUMB + 2 * edge
	const centred = index * FILMSTRIP_THUMB
	if (viewport <= 0) {
		return { edge, width, centred, first: 0, end: 0 }
	}
	const end = Math.min(count, Math.ceil((offset + viewport - edge) / FILMSTRIP_THUMB) + FILMSTRIP_OVERSCAN)
	const first = Math.min(end, Math.max(0, Math.floor((offset - edge) / FILMSTRIP_THUMB) - FILMSTRIP_OVERSCAN))
	return { edge, width, centred, first, end }
}
