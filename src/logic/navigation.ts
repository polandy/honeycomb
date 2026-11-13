// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** From this viewport width on, in CSS pixels, the navigation starts open while the user made no choice. */
export const NAVIGATION_OPEN_MIN_WIDTH = 1280

/** Whether the navigation starts open: the user's stored choice, else open on a wide screen only. */
export function startsOpen(stored: string | null, width: number): boolean {
	if (stored === 'true' || stored === 'false') {
		return stored === 'true'
	}
	return width >= NAVIGATION_OPEN_MIN_WIDTH
}
