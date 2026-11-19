// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { getCurrentScope, onScopeDispose } from 'vue'
import { NO_ACTIVE_TIME, takenSeconds, withActiveInput } from './logic/active-time.ts'

/** The inputs that count towards active time (glossary: active time). */
export const ACTIVE_INPUTS = ['pointerdown', 'keydown', 'wheel'] as const

/** Measures active time from the window's inputs until the scope ends; `take` hands out each whole second once (STATS-001). */
export function useActiveTime(now: () => number) {
	let time = NO_ACTIVE_TIME
	const input = () => {
		time = withActiveInput(time, now())
	}
	ACTIVE_INPUTS.forEach((type) => window.addEventListener(type, input, { capture: true, passive: true }))
	if (getCurrentScope() !== undefined) {
		onScopeDispose(() => ACTIVE_INPUTS.forEach((type) => window.removeEventListener(type, input, { capture: true })))
	}

	/** The whole seconds measured since the last take. */
	function take(): number {
		const taken = takenSeconds(time)
		time = taken.rest
		return taken.seconds
	}

	return { take }
}
