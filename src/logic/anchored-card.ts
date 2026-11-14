// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** An anchor's start and width inside its box, in px. */
export interface AnchorSpan {
	left: number
	width: number
}

/** How far the card's end reaches past the anchor's end, and the least room it keeps to the box's edges, in px. */
export interface CardRoom {
	overhang: number
	margin: number
}

/**
 * Where a card of `card` px under the anchor goes in a box of `box` px: its end `overhang` past the
 * anchor's end, kept `margin` inside the box. `left` is from the anchor's start, `arrow` the
 * anchor's centre from the card's start.
 */
export function placeUnderAnchor(anchor: AnchorSpan, card: number, box: number, room: CardRoom): { left: number, arrow: number } {
	const start = Math.max(room.margin, Math.min(anchor.left + anchor.width + room.overhang - card, box - room.margin - card))
	return { left: start - anchor.left, arrow: anchor.left + anchor.width / 2 - start }
}
