// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './long-press.ts'
import type { PairingEntry, Picture } from './pairing.ts'

import { badgeExtension } from './pair-badge.ts'

/** How long the mouse rests on a tile before its tile info shows (GRID-004.7). */
export const TILE_INFO_DELAY_MS = 700

/** The most stars a rating has. */
const MAX_RATING = 5

/** The timer of the tile info: one tile waits or shows at a time, with no hand-over to the next. */
export function tileInfoTimer<T>(schedule: Schedule, show: (tile: T | null) => void) {
	let waiting: T | null = null
	let shown: T | null = null
	let cancel = () => undefined as void

	/** Drops the waiting tile and hides the shown one; true when one was shown. */
	function hide(): boolean {
		cancel()
		waiting = null
		if (shown === null) {
			return false
		}
		shown = null
		show(null)
		return true
	}

	return {
		/** The mouse rests on `tile`: its tile info shows after the delay unless it already waits or shows. */
		rest(tile: T) {
			if (tile === waiting || tile === shown) {
				return
			}
			hide()
			waiting = tile
			cancel = schedule(() => {
				waiting = null
				shown = tile
				show(tile)
			}, TILE_INFO_DELAY_MS)
		},
		/** A tap on a tile's ⓘ button: shows its tile info at once, or hides it when it already shows. */
		toggle(tile: T) {
			const wasShown = tile === shown
			hide()
			if (!wasShown) {
				shown = tile
				show(tile)
			}
		},
		hide,
	}
}

/** The extensions of a picture's members as its badge writes them, the rendered member first. */
export function tileInfoMembers(picture: Picture<PairingEntry>): readonly string[] {
	return [picture.rendered, picture.raw].filter((member) => member !== null).map(badgeExtension)
}

/** A rating as five filled or empty stars. */
export function ratingStars(rating: number): string {
	return '★'.repeat(rating) + '☆'.repeat(MAX_RATING - rating)
}
