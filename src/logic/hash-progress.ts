// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Where a hashable picture's visual hash stands (SERIES-003.16). */
export type HashState = 'hashed' | 'pending' | 'failed'

/** How far the visual hashes of the hashable pictures are: still running, done with failures, or done. */
export interface HashProgress {
	readonly phase: 'running' | 'failed' | 'done'
	readonly hashed: number
	readonly failed: number
	readonly total: number
}

/** The progress of the given hash states; a failed save counts once none is pending (SERIES-003.18–.20). */
export function hashProgress(states: readonly HashState[], saveFailed: boolean): HashProgress {
	const count = (state: HashState) => states.filter((each) => each === state).length
	const hashed = count('hashed')
	const failed = count('failed')
	const pending = states.length - hashed - failed
	const phase = pending > 0 ? 'running' : failed > 0 || saveFailed ? 'failed' : 'done'
	return { phase, hashed, failed, total: states.length }
}
