// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from '../logic/long-press.ts'

/** Runs `run` after `ms` on the browser's timer. */
export const browserSchedule: Schedule = (run, ms) => {
	const timer = globalThis.setTimeout(run, ms)
	return () => globalThis.clearTimeout(timer)
}
