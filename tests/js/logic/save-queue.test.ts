// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SaveResult } from '../../../src/logic/save-queue.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { saveQueue } from '../../../src/logic/save-queue.ts'

interface Row { fileId: number, value: string }

/** A sender whose saves the test settles one by one, in order. */
function fakeSender() {
	const sent: Row[][] = []
	const settle: { resolve: () => void, reject: (error: Error) => void }[] = []
	const send = (rows: readonly Row[]) => new Promise<void>((resolve, reject) => {
		sent.push([...rows])
		settle.push({ resolve, reject })
	})
	return { sent, send, finish: (index: number) => settle[index]!.resolve(), fail: (index: number, error: Error) => settle[index]!.reject(error) }
}

/** Records each save's result under its name, in the order they settle. */
function recorder() {
	const results: [string, SaveResult<Row>][] = []
	return { results, record: (name: string) => (result: SaveResult<Row>) => results.push([name, result]) }
}

describe('saveQueue', () => {
	// spec: DECISIONS-001.14
	it('sends one save at a time and then the waiting rows together, the newest per file id', async () => {
		const sender = fakeSender()
		const save = saveQueue(sender.send)
		const { results, record } = recorder()

		void save([{ fileId: 1, value: 'a' }]).then(record('first'))
		void save([{ fileId: 1, value: 'b' }, { fileId: 2, value: 'x' }]).then(record('second'))
		void save([{ fileId: 1, value: 'c' }]).then(record('third'))
		expect(sender.sent).toEqual([[{ fileId: 1, value: 'a' }]])

		sender.finish(0)
		await flushPromises()
		expect(sender.sent).toEqual([[{ fileId: 1, value: 'a' }], [{ fileId: 1, value: 'c' }, { fileId: 2, value: 'x' }]])
		expect(results).toEqual([['first', { ok: true }]])

		sender.finish(1)
		await flushPromises()
		expect(results).toEqual([['first', { ok: true }], ['second', { ok: true }], ['third', { ok: true }]])
		expect(sender.sent).toHaveLength(2)
	})

	// spec: DECISIONS-001.15
	it('answers a failed save once the queue is idle, without the rows a later save stored', async () => {
		const sender = fakeSender()
		const save = saveQueue(sender.send)
		const { results, record } = recorder()
		const error = new Error('down')

		void save([{ fileId: 1, value: 'a' }, { fileId: 2, value: 'a' }]).then(record('first'))
		void save([{ fileId: 1, value: 'b' }]).then(record('second'))
		sender.fail(0, error)
		await flushPromises()
		expect(results).toEqual([])

		sender.finish(1)
		await flushPromises()
		expect(results).toEqual([['second', { ok: true }], ['first', { ok: false, error, unsaved: [{ fileId: 2, value: 'a' }] }]])
	})

	// spec: DECISIONS-001.15
	it('answers the failed saves newest first, each with its own rows', async () => {
		const sender = fakeSender()
		const save = saveQueue(sender.send)
		const { results, record } = recorder()
		const first = new Error('first down')
		const second = new Error('second down')

		void save([{ fileId: 1, value: 'a' }]).then(record('first'))
		void save([{ fileId: 1, value: 'b' }]).then(record('second'))
		void save([{ fileId: 2, value: 'x' }]).then(record('third'))
		sender.fail(0, first)
		await flushPromises()
		sender.fail(1, second)
		await flushPromises()

		expect(results).toEqual([
			['third', { ok: false, error: second, unsaved: [{ fileId: 2, value: 'x' }] }],
			['second', { ok: false, error: second, unsaved: [{ fileId: 1, value: 'b' }] }],
			['first', { ok: false, error: first, unsaved: [{ fileId: 1, value: 'a' }] }],
		])
	})

	// spec: DECISIONS-001.14
	it('sends at once again when the queue went idle', async () => {
		const sender = fakeSender()
		const save = saveQueue(sender.send)

		void save([{ fileId: 1, value: 'a' }])
		sender.finish(0)
		await flushPromises()
		void save([{ fileId: 1, value: 'b' }])

		expect(sender.sent).toEqual([[{ fileId: 1, value: 'a' }], [{ fileId: 1, value: 'b' }]])
	})
})
