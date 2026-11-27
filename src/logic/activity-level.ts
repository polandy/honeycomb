// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** How full a calendar square is: 0 without a counter, 1 to 3 the share of the busiest square. */
export type ActivityLevel = 0 | 1 | 2 | 3

const THIRDS = 3

/** The level of a square by its pictures decided against the busiest square's (STATS-001.71). */
export function activityLevel(decided: number, busiest: number, active: boolean): ActivityLevel {
	if (!active) {
		return 0
	}
	if (decided === 0 || decided * THIRDS <= busiest) {
		return 1
	}
	return decided * THIRDS <= 2 * busiest ? 2 : 3
}
