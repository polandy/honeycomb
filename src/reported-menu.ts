// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { onBeforeUnmount } from 'vue'

/** Passes a menu's open state on to `report`, and its closing when it unmounts open, so the parent's count of open menus stays true. */
export function useReportedMenu(report: (open: boolean) => void): (open: boolean) => void {
	let isOpen = false
	onBeforeUnmount(() => {
		if (isOpen) {
			report(false)
		}
	})
	return (open) => {
		isOpen = open
		report(open)
	}
}
