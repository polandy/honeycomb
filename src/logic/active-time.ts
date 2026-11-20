// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The longest pause active time counts (glossary: active time). */
export const IDLE_LIMIT_MS = 120_000
const SECOND_MS = 1000

/** The active time measured so far and the moment of the last input, in ms. */
export interface ActiveTime {
	readonly ms: number
	readonly lastInput: number | null
}

/** No input yet. */
export const NO_ACTIVE_TIME: ActiveTime = { ms: 0, lastInput: null }

/** The active time from the last input to `at`, at most IDLE_LIMIT_MS, none before the first input. */
export function sinceLastInput(lastInput: number | null, at: number): number {
	return lastInput === null ? 0 : Math.min(at - lastInput, IDLE_LIMIT_MS)
}

/** The active time with an input at `at` ms. */
export function withActiveInput(time: ActiveTime, at: number): ActiveTime {
	return { ms: time.ms + sinceLastInput(time.lastInput, at), lastInput: at }
}

/** The whole seconds of the active time, and the time that keeps the rest for the next take. */
export function takenSeconds(time: ActiveTime): { readonly seconds: number, readonly rest: ActiveTime } {
	const seconds = Math.floor(time.ms / SECOND_MS)
	return { seconds, rest: { ...time, ms: time.ms - seconds * SECOND_MS } }
}
