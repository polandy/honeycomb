// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How close to the grid's top or bottom edge a dragging finger scrolls it, in CSS pixels. */
export const AUTO_SCROLL_EDGE = 48

/** How far the grid scrolls in one frame with the finger at the edge, in CSS pixels. */
export const AUTO_SCROLL_MAX_STEP = 16

/** The scroll of one frame for a finger at `y` in a grid `height` high: negative up, 0 outside the edges. */
export function autoScrollStep(y: number, height: number): number {
	const edge = Math.min(AUTO_SCROLL_EDGE, height / 2)
	const depth = y < edge ? y - edge : y > height - edge ? y - (height - edge) : 0
	return Math.max(-1, Math.min(1, depth / edge)) * AUTO_SCROLL_MAX_STEP
}
