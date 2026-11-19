// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FlagAnswer, FlagItem } from '../../src/flags-api.ts'

import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCullFlags } from '../../src/cull-flags.ts'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'

vi.mock('../../src/logger.ts', () => ({ logger: { warn: vi.fn(), error: vi.fn() } }))

const SAVED: FlagAnswer = { saved: [], skipped: [] }
const row = (fileId: number) => ({ fileId, ...UNDECIDED, flag: 'picked' as const, rating: 3 })

/** A save the test answers by hand, in the order the saves were sent. */
function pendingApi() {
	const sent: FlagItem[][] = []
	const answers: ((answer: FlagAnswer | Error) => void)[] = []
	const save = (items: readonly FlagItem[]) => {
		sent.push([...items])
		return new Promise<FlagAnswer>((resolve, reject) => answers.push((answer) => answer instanceof Error ? reject(answer) : resolve(answer)))
	}
	return { api: { save, takeOver: vi.fn(async () => SAVED) }, sent, answers }
}

beforeEach(() => {
	vi.clearAllMocks()
})

describe('useCullFlags', () => {
	// spec: XMP-003.38
	it('sends the flag fields of a save only after the save before has answered', async () => {
		const { api, sent, answers } = pendingApi()
		const flags = useCullFlags(api)

		const first = flags.save([row(1)])
		const second = flags.save([row(2)])
		await flushPromises()
		expect(sent).toEqual([[{ fileId: 1, flag: 'picked', keepRaw: false }]])

		answers[0]!(SAVED)
		await flushPromises()
		answers[1]!(SAVED)

		await expect(first).resolves.toEqual(new Set())
		await expect(second).resolves.toEqual(new Set())
		expect(sent).toHaveLength(2)
	})

	// spec: DELETE-002.28
	it('flushes once every save sent has answered, failed or not', async () => {
		const { api, answers } = pendingApi()
		const flags = useCullFlags(api)
		let flushed = false
		void flags.save([row(1)])
		void flags.save([row(2)])
		void flags.flush().then(() => (flushed = true))
		await flushPromises()

		answers[0]!(new Error('offline'))
		await flushPromises()
		expect(flushed).toBe(false)
		answers[1]!(SAVED)
		await flushPromises()

		expect(flushed).toBe(true)
		await expect(useCullFlags(api).flush()).resolves.toBeUndefined()
	})

	// spec: XMP-008.17
	it('answers the ids the server skipped and warns', async () => {
		const { api, answers } = pendingApi()
		const saved = useCullFlags(api).save([row(1), row(2)])
		await flushPromises()

		answers[0]!({ saved: [1], skipped: [{ fileId: 2, reason: 'notPermitted' }] })

		await expect(saved).resolves.toEqual(new Set([2]))
		expect(logger.warn).toHaveBeenCalledWith('The server did not save some flags; they are taken back', expect.anything())
	})

	// spec: XMP-008.17
	it('answers every id when the save fails, logs it and still sends the next save', async () => {
		const { api, sent, answers } = pendingApi()
		const flags = useCullFlags(api)
		const failed = flags.save([row(1), row(2)])
		const next = flags.save([row(3)])
		await flushPromises()

		answers[0]!(new Error('offline'))
		await expect(failed).resolves.toEqual(new Set([1, 2]))
		expect(logger.error).toHaveBeenCalledWith('Could not save the flags; they are taken back', expect.anything())

		await flushPromises()
		answers[1]!(SAVED)
		await expect(next).resolves.toEqual(new Set())
		expect(sent).toHaveLength(2)
	})

	// spec: XMP-003.34
	it('takes the rows over and sends nothing for none', async () => {
		const { api } = pendingApi()
		const flags = useCullFlags(api)

		flags.takeOver([])
		flags.takeOver([row(4)])

		expect(api.takeOver).toHaveBeenCalledOnce()
		expect(api.takeOver).toHaveBeenCalledWith([{ fileId: 4, flag: 'picked', keepRaw: false }])
	})

	// spec: XMP-003.36
	it('warns when the take-over fails', async () => {
		const { api } = pendingApi()
		api.takeOver.mockRejectedValueOnce(new Error('offline'))

		useCullFlags(api).takeOver([row(4)])
		await flushPromises()

		expect(logger.warn).toHaveBeenCalledWith('Could not take the flags over; the photos show what their sidecars state', expect.anything())
	})
})
