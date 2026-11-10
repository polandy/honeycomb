// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A target folder the move dialog offers, with its number key. */
export interface TargetChip {
	readonly path: string
	readonly favourite: boolean
	readonly key: number
}

const MAX_CHIPS = 9
const RECENT_KEPT = 5

/** The favourite targets, then the recent ones that are not favourites, at most 9, numbered from 1. */
export function targetChips(favourites: readonly string[], recent: readonly string[]): TargetChip[] {
	return [
		...favourites.map((path) => ({ path, favourite: true })),
		...recent.filter((path) => !favourites.includes(path)).map((path) => ({ path, favourite: false })),
	].slice(0, MAX_CHIPS).map((chip, index) => ({ ...chip, key: index + 1 }))
}

/** The recent targets with the path first, each once, 5 kept. */
export function addRecent(recent: readonly string[], path: string): string[] {
	return [path, ...recent.filter((each) => each !== path)].slice(0, RECENT_KEPT)
}

/** The favourite targets with the path added at the end, or without it when it is one. */
export function toggleFavourite(favourites: readonly string[], path: string): string[] {
	return favourites.includes(path) ? favourites.filter((each) => each !== path) : [...favourites, path]
}

/** The folder's own name; the root is `/`. */
export function folderName(path: string): string {
	return path.split('/').pop() || '/'
}

/** The path of the folder's parent; the root is `/`. */
export function parentName(path: string): string {
	return path.slice(0, path.lastIndexOf('/')) || '/'
}
