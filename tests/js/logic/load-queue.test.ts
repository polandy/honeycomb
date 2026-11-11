// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createLoadQueue } from '../../../src/logic/load-queue.ts'

/** A loader whose loads the test settles one by one, by URL. */
function fakeLoader() {
	const started: string[] = []
	const settle = new Map<string, { resolve: () => void, reject: (error: Error) => void }>()
	const load = (url: string) => new Promise<void>((resolve, reject) => {
		started.push(url)
		settle.set(url, { resolve, reject })
	})
	return { started, load, finish: (url: string) => settle.get(url)!.resolve(), fail: (url: string) => settle.get(url)!.reject(new Error(`no ${url}`)) }
}

const ignore = () => undefined

describe('createLoadQueue', () => {
	// spec: GRID-001.15
	it('keeps at most the limit in flight and starts the next as one settles', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 2)

		const outcomes: [string, boolean][] = []
		for (const url of ['a', 'b', 'c', 'd']) {
			queue.enqueue(url, 0, (loaded) => outcomes.push([url, loaded]))
		}
		expect(loader.started).toEqual(['a', 'b'])

		loader.finish('a')
		await flushPromises()
		expect(loader.started).toEqual(['a', 'b', 'c'])

		loader.fail('b')
		await flushPromises()
		expect(loader.started).toEqual(['a', 'b', 'c', 'd'])
		expect(outcomes).toEqual([['a', true], ['b', false]])
	})

	// spec: GRID-001.15
	it('starts the lowest priority first, in request order within one priority', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 1)
		queue.enqueue('busy', 0, ignore)
		queue.enqueue('late', 2, ignore)
		queue.enqueue('first', 1, ignore)
		queue.enqueue('second', 1, ignore)

		for (const url of ['busy', 'first', 'second']) {
			loader.finish(url)
			await flushPromises()
		}

		expect(loader.started).toEqual(['busy', 'first', 'second', 'late'])
	})

	// spec: GRID-001.15
	it('moves a waiting load when its priority changes', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 1)
		queue.enqueue('busy', 0, ignore)
		queue.enqueue('near', 1, ignore)
		const far = queue.enqueue('far', 2, ignore)

		far.prioritise(0)
		loader.finish('busy')
		await flushPromises()

		expect(loader.started).toEqual(['busy', 'far'])
	})

	// spec: GRID-001.15
	it('never starts a cancelled load and keeps the slot of a cancelled running one until it settles', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 1)
		const running = queue.enqueue('running', 0, ignore)
		queue.enqueue('dropped', 0, ignore).cancel()
		queue.enqueue('next', 0, ignore)

		running.cancel()
		await flushPromises()
		expect(loader.started).toEqual(['running'])

		loader.finish('running')
		await flushPromises()
		expect(loader.started).toEqual(['running', 'next'])
	})

	// spec: GRID-001.15
	it('lets a settled load queue its follow-up before the next waiting load starts', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 1)
		queue.enqueue('small', 0, () => queue.enqueue('sharp', 1, ignore))
		queue.enqueue('other', 2, ignore)

		loader.finish('small')
		await flushPromises()

		expect(loader.started).toEqual(['small', 'sharp'])
	})

	it('ignores a priority change once the load has started', async () => {
		const loader = fakeLoader()
		const queue = createLoadQueue(loader.load, 1)
		const running = queue.enqueue('running', 0, ignore)
		queue.enqueue('next', 1, ignore)

		running.prioritise(5)
		running.cancel()
		running.prioritise(0)
		loader.finish('running')
		await flushPromises()

		expect(loader.started).toEqual(['running', 'next'])
	})
})
