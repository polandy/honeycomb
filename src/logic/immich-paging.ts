// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichEntry } from './immich-asset.ts'

/** One page of the listing (ADR 0044); a cursor is `null` at the end it names. */
export interface Page {
	readonly entries: readonly ImmichEntry[]
	readonly nextCursor: string | null
	readonly previousCursor: string | null
}

/** One end of the loaded entries: where paging goes on. */
export type PageEnd = 'next' | 'previous'

/** Whether a page is being asked at an end, or the last ask failed and waits for *Try again*. */
export type PageState = 'idle' | 'loading' | 'failed'

/** The pages loaded so far, as one run of entries, and how each end goes on. */
export interface PagedList {
	readonly entries: readonly ImmichEntry[]
	/** Whether the first page arrived; before it, the cursors mean nothing. */
	readonly started: boolean
	readonly nextCursor: string | null
	readonly previousCursor: string | null
	readonly next: PageState
	readonly previous: PageState
}

/** A position in the loupe, `null` while newer pages are not loaded and the offset is unknown (IMMICH-002.27). */
export interface LoupeCounter {
	readonly position: number | null
	readonly total: number
}

/** How close to the last loaded entry the loupe asks for the next page (IMMICH-002.9). */
export const LOUPE_AHEAD = 12

/** A listing before its first page. */
export const EMPTY_LIST: PagedList = { entries: [], started: false, nextCursor: null, previousCursor: null, next: 'idle', previous: 'idle' }

/** Whether to ask the next page: the first one, or the last shown entry is within `ahead` of the last loaded one. */
export function wantsNext(list: PagedList, lastShown: number, ahead: number): boolean {
	if (list.next !== 'idle') {
		return false
	}
	return !list.started || (list.nextCursor !== null && list.entries.length - 1 - lastShown < ahead)
}

/** Whether to ask the previous page: the first shown entry is within the loupe's reach of the first loaded one. */
export function wantsPrevious(list: PagedList, firstShown: number): boolean {
	return list.previous === 'idle' && list.previousCursor !== null && firstShown < LOUPE_AHEAD
}

/** The list once a page was asked at the end. */
export function pageAsked(list: PagedList, end: PageEnd): PagedList {
	return { ...list, [end]: 'loading' }
}

/** The list once the asked page failed; the cursor stays, so *Try again* asks it again (IMMICH-002.19). */
export function pageFailed(list: PagedList, end: PageEnd): PagedList {
	return { ...list, [end]: 'failed' }
}

/** The list with the page added at its end, each asset once. */
export function pageArrived(list: PagedList, end: PageEnd, page: Page): PagedList {
	const held = new Set(list.entries.map((entry) => entry.assetId))
	const fresh = page.entries.filter((entry) => !held.has(entry.assetId))
	if (end === 'previous') {
		return { ...list, entries: [...fresh, ...list.entries], previousCursor: page.previousCursor, previous: 'idle' }
	}
	return {
		...list,
		entries: [...list.entries, ...fresh],
		started: true,
		nextCursor: page.nextCursor,
		previousCursor: list.started ? list.previousCursor : page.previousCursor,
		next: 'idle',
	}
}

/** The list with the entry of the same asset swapped, e.g. after a decision. */
export function replaceEntry(list: PagedList, entry: ImmichEntry): PagedList {
	return { ...list, entries: list.entries.map((held) => held.assetId === entry.assetId ? entry : held) }
}

/** The loupe's *k / N* for the loaded entry at `index`, against the server's total. */
export function loupeCounter(list: PagedList, index: number, total: number): LoupeCounter {
	return { position: list.previousCursor === null ? index + 1 : null, total }
}
