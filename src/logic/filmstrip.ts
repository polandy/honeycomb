// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Series } from './series.ts'

import { seriesRuns } from './series-runs.ts'

/** The side of a filmstrip photo in CSS pixels; the strip is as high. */
export const FILMSTRIP_THUMB = 56

/** The width of the column before a series run's first photo that holds its tab, a finger's reach. */
export const FILMSTRIP_TAB = 44

/** How many photos the filmstrip renders beyond each end of its view, so a scroll shows no gap. */
export const FILMSTRIP_OVERSCAN = 4

/** Where the filmstrip stands: the shown picture, the picture count, the strip's width, its scroll offset and the photos a tab column comes before. */
export interface FilmstripView {
	readonly index: number
	readonly count: number
	readonly viewport: number
	readonly offset: number
	readonly tabs: readonly number[]
}

/** The filmstrip's geometry: the scroll width, the offset that brings the shown picture as near the middle as the strip's ends allow, and the photos to render, `first` up to but not including `end`. */
export interface FilmstripLayout {
	readonly width: number
	readonly centred: number
	readonly first: number
	readonly end: number
}

/** The left edge of the photo at `index`: the photos and the tab columns before it, `tabs` holding the photos a column comes before in order. */
export function filmstripLeft(index: number, tabs: readonly number[]): number {
	return index * FILMSTRIP_THUMB + tabsUpTo(index, tabs) * FILMSTRIP_TAB
}

/** Lays the photos edge to edge from the strip's left edge, a tab column before each of `tabs`; the strip scrolls the shown one to the middle but never past either end. */
export function filmstripLayout({ index, count, viewport, offset, tabs }: FilmstripView): FilmstripLayout {
	const width = count * FILMSTRIP_THUMB + tabs.length * FILMSTRIP_TAB
	if (viewport <= 0) {
		return { width, centred: 0, first: 0, end: 0 }
	}
	const middle = filmstripLeft(index, tabs) + FILMSTRIP_THUMB / 2 - viewport / 2
	const centred = Math.min(Math.max(0, width - viewport), Math.max(0, middle))
	const end = Math.min(count, photosBefore(offset + viewport, count, tabs, false) + FILMSTRIP_OVERSCAN)
	const first = Math.min(end, Math.max(0, photosBefore(offset, count, tabs, true) - 1 - FILMSTRIP_OVERSCAN))
	return { width, centred, first, end }
}

/** How many of `tabs`, in ascending order, come at or before the photo at `index`: the first one past it by bisection. */
function tabsUpTo(index: number, tabs: readonly number[]): number {
	let [low, high] = [0, tabs.length]
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		if (tabs[middle]! <= index) {
			low = middle + 1
		} else {
			high = middle
		}
	}
	return low
}

/** How many of the `count` photos start before `edge`, or at it too when `atEdge`: the first one past it by bisection. */
function photosBefore(edge: number, count: number, tabs: readonly number[], atEdge: boolean): number {
	let [low, high] = [0, count]
	while (low < high) {
		const middle = Math.floor((low + high) / 2)
		const left = filmstripLeft(middle, tabs)
		if (left < edge || (atEdge && left === edge)) {
			low = middle + 1
		} else {
			high = middle
		}
	}
	return low
}

/** A frame around a run of neighbours in one series: the photos `first` up to but not including `end`, and the series' size. */
export interface FilmstripFrame {
	readonly first: number
	readonly end: number
	readonly count: number
}

/** The frames around each run of neighbouring photos that share a series; a picture outside every series breaks a run unless `spans` lets it in. */
export function filmstripFrames<P>(pictures: readonly P[], seriesOf: ReadonlyMap<P, Series<P>>, spans?: (picture: P) => boolean): FilmstripFrame[] {
	return seriesRuns(pictures, seriesOf, [], spans).map(({ first, end, series }) => ({ first, end, count: series.members.length }))
}
