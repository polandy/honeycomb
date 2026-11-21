// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { RequestTimeoutError, withTimeout } from '../../../src/logic/timed-request.ts'
import { fakeScheduler } from '../fake-scheduler.ts'

/** A request that answers only when the test says so and fails once it is aborted. */
function pendingRequest() {
	let answer: (value: string) => void = () => {}
	let signal: AbortSignal | null = null
	const request = (given: AbortSignal) => new Promise<string>((resolve, reject) => {
		signal = given
		answer = resolve
		given.addEventListener('abort', () => reject(new Error('canceled')))
	})
	return { request, answer: (value: string) => answer(value), signal: () => signal }
}

describe('withTimeout', () => {
	// spec: MOVE-004.20, DELETE-002.29, DECISIONS-002.19
	it('aborts a request that does not answer in time and fails with the seconds it waited', async () => {
		const { timers, schedule, fire } = fakeScheduler()
		const pending = pendingRequest()

		const answer = withTimeout(pending.request, 90_000, schedule)
		expect(timers.map(({ ms }) => ms)).toEqual([90_000])
		fire()

		const error: unknown = await answer.catch((caught: unknown) => caught)
		expect(error).toBeInstanceOf(RequestTimeoutError)
		expect((error as RequestTimeoutError).seconds).toBe(90)
		expect(pending.signal()?.aborted).toBe(true)
	})

	it('answers before the time is up and stops the timer', async () => {
		const { timers, schedule } = fakeScheduler()
		const pending = pendingRequest()

		const answer = withTimeout(pending.request, 30_000, schedule)
		pending.answer('listed')

		expect(await answer).toBe('listed')
		expect(timers[0]!.cancelled).toBe(true)
		expect(pending.signal()?.aborted).toBe(false)
	})

	it('passes a failure of the request on and stops the timer', async () => {
		const { timers, schedule } = fakeScheduler()
		const error = new Error('Network Error')

		await expect(withTimeout(async () => Promise.reject(error), 30_000, schedule)).rejects.toBe(error)
		expect(timers[0]!.cancelled).toBe(true)
	})
})
