// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { DEFAULT_RETRY_AFTER_SECONDS, retryAfterSeconds } from '../../src/logic/retry-after.ts'

describe('retryAfterSeconds', () => {
	// spec: SERIES-004.14
	it('takes the seconds of the header', () => {
		expect(retryAfterSeconds('30')).toBe(30)
		expect(retryAfterSeconds(' 7 ')).toBe(7)
	})

	// spec: SERIES-004.14
	it('waits at least one second', () => {
		expect(retryAfterSeconds('0')).toBe(1)
	})

	// spec: SERIES-004.14
	it('falls back to the period of the limit without a number of seconds', () => {
		expect(DEFAULT_RETRY_AFTER_SECONDS).toBe(60)
		for (const header of [undefined, null, '', 'soon', '-5', '1.5', 'Wed, 21 Oct 2026 07:28:00 GMT', 30]) {
			expect(retryAfterSeconds(header)).toBe(DEFAULT_RETRY_AFTER_SECONDS)
		}
	})
})
