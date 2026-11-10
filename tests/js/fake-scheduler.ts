// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Schedule } from '../../src/logic/long-press.ts'

/** A scheduler whose timers the test runs by hand. */
export function fakeScheduler() {
	const timers: { run: () => void, ms: number, cancelled: boolean }[] = []
	const schedule: Schedule = (run, ms) => {
		const timer = { run, ms, cancelled: false }
		timers.push(timer)
		return () => {
			timer.cancelled = true
		}
	}
	const fire = () => timers.filter((timer) => !timer.cancelled).forEach((timer) => {
		timer.cancelled = true
		timer.run()
	})
	return { timers, schedule, fire }
}
