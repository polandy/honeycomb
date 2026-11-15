// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_RETRY_AFTER_SECONDS, RateLimitedError, retryAfterSeconds, sendLimited, waitSeconds } from '../../src/logic/retry-after.ts'

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

describe('sendLimited', () => {
	// spec: SERIES-004.14, SERIES-003.27
	it('waits as long as each limited answer asks and sends again', async () => {
		const send = vi.fn().mockRejectedValueOnce(new RateLimitedError(42)).mockRejectedValueOnce(new RateLimitedError(7)).mockResolvedValue('sent')
		const wait = vi.fn(async () => {})
		const waiting = vi.fn()

		await expect(sendLimited(send, wait, waiting)).resolves.toBe('sent')

		expect(send).toHaveBeenCalledTimes(3)
		expect(wait.mock.calls).toEqual([[42], [7]])
		expect(waiting.mock.calls).toEqual([[42], [null], [7], [null]])
	})

	// spec: SERIES-003.13
	it('fails at once on any other failure', async () => {
		const wait = vi.fn(async () => {})

		await expect(sendLimited(() => Promise.reject(new Error('offline')), wait)).rejects.toThrow('offline')
		expect(wait).not.toHaveBeenCalled()
	})

	// spec: SERIES-004.14
	it('gives up once no longer wanted, before or after the wait', async () => {
		const limited = () => Promise.reject(new RateLimitedError(5))
		let wanted = true
		const wait = vi.fn(async () => {
			wanted = false
		})

		await expect(sendLimited(limited, wait, () => {}, () => wanted)).resolves.toBeNull()
		await expect(sendLimited(limited, wait, () => {}, () => wanted)).rejects.toBeInstanceOf(RateLimitedError)
		expect(wait).toHaveBeenCalledTimes(1)
	})
})

describe('waitSeconds', () => {
	// spec: SERIES-003.27
	it('resolves when the schedule runs after the seconds', async () => {
		const scheduled: { run: () => void, ms: number }[] = []
		const waited = waitSeconds((run, ms) => {
			scheduled.push({ run, ms })
			return () => {}
		})(60)

		expect(scheduled.map((each) => each.ms)).toEqual([60_000])
		scheduled[0]!.run()
		await expect(waited).resolves.toBeUndefined()
	})
})
