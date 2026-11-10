// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from './logic/long-press.ts'

import { onBeforeUnmount, readonly, ref } from 'vue'

/** How long the loupe's overlays stay after the last touch (`docs/plan.md` Loupe layout). */
export const LOUPE_IDLE_MS = 2500

/** Overlays that hide `ms` after the last wake unless `keepAwake` holds then. */
export function useIdle(schedule: Schedule, ms: number, keepAwake: () => boolean) {
	const idle = ref(false)
	let cancel = () => undefined as void

	/** Shows the overlays and restarts the idle timer. */
	function wake() {
		cancel()
		idle.value = false
		cancel = schedule(() => {
			idle.value = !keepAwake()
		}, ms)
	}

	/** Hides the overlays at once. */
	function hide() {
		cancel()
		idle.value = true
	}

	wake()
	onBeforeUnmount(() => cancel())
	return { idle: readonly(idle), wake, hide, toggle: () => (idle.value ? wake() : hide()) }
}
