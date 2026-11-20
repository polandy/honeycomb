// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { IDLE_LIMIT_MS, NO_ACTIVE_TIME, picturesPerMinute, takenSeconds, withActiveInput } from '../../../src/logic/active-time.ts'

const MINUTE = 60_000

describe('withActiveInput', () => {
	// spec: STATS-001.17
	it('counts the time between inputs, at most the idle limit each', () => {
		let time = NO_ACTIVE_TIME
		for (let at = 0; at <= 5 * MINUTE; at += 30_000) {
			time = withActiveInput(time, at)
		}
		for (let at = 15 * MINUTE; at <= 18 * MINUTE; at += 30_000) {
			time = withActiveInput(time, at)
		}

		expect(time.ms).toBe(5 * MINUTE + IDLE_LIMIT_MS + 3 * MINUTE)
	})
})

describe('takenSeconds', () => {
	// spec: STATS-001.39
	it('takes the whole seconds and keeps the rest for the next save', () => {
		const time = withActiveInput(withActiveInput(NO_ACTIVE_TIME, 0), 90_400)

		const first = takenSeconds(time)
		const second = takenSeconds(withActiveInput(first.rest, 91_000))

		expect(first.seconds).toBe(90)
		expect(second.seconds).toBe(1)
		expect(takenSeconds(second.rest).seconds).toBe(0)
	})
})

describe('picturesPerMinute', () => {
	it('is the pictures a minute of active time from one active minute on, else null', () => {
		expect(picturesPerMinute(15, 2 * MINUTE)).toBe(7.5)
		expect(picturesPerMinute(15, MINUTE - 1)).toBeNull()
	})
})
