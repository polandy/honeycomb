// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How many pictures ahead of the shown one the loupe loads (`docs/plan.md` Image delivery). */
export const PREFETCH_AHEAD = 3

/** How many pictures behind the shown one the loupe loads. */
export const PREFETCH_BEHIND = 2

/** The indexes the loupe loads around `index` of `count` pictures, nearest first, ahead before behind. */
export function prefetchOrder(index: number, count: number): number[] {
	const order: number[] = []
	for (let distance = 1; distance <= Math.max(PREFETCH_AHEAD, PREFETCH_BEHIND); distance++) {
		if (distance <= PREFETCH_AHEAD && index + distance < count) {
			order.push(index + distance)
		}
		if (distance <= PREFETCH_BEHIND && index - distance >= 0) {
			order.push(index - distance)
		}
	}
	return order
}
