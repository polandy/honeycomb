// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Ref } from 'vue'

import { watch } from 'vue'
import { isAppended, isRemoval } from '../logic/appended.ts'
import { keptIndex } from '../logic/loupe-pictures.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'

/** What the grid's focus is kept on. */
export interface KeptFocusTargets<P> {
	pictures: () => readonly P[]
	focused: Ref<number>
	scroller: () => HTMLElement | null
	/** Scrolls and focuses the tile at the index. */
	reveal: (index: number) => Promise<void>
	/** Starts at the top again, as for the pictures of another cull. */
	toTop: () => void
}

/** Keeps the focus on its photo when photos only leave the grid, as a decision the filters refuse does; other changes start at the top (IMMICH-003.25). */
export function useKeptFocus<P>(targets: KeptFocusTargets<P>) {
	watch(targets.pictures, (next, previous) => {
		if (isAppended(previous, next)) {
			return
		}
		if (!isRemoval(previous, next)) {
			targets.toTop()
			return
		}
		const index = Math.max(0, keptIndex(previous, next, targets.focused.value))
		const scroller = targets.scroller()
		if (scroller?.contains(scroller.ownerDocument.activeElement) === true) {
			fireAndLog(targets.reveal(index), 'Could not keep the focus on its photo')
		} else {
			targets.focused.value = index
		}
	})
}
