// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { BUNDLE_IDLE_MS, pictureBundle } from '../../../src/logic/picture-bundle.ts'
import { fakeScheduler } from '../fake-scheduler.ts'

/** A bundle of named pictures whose writes are logged, and the pictures it reported waiting. */
function bundled() {
	const scheduler = fakeScheduler()
	const written: string[] = []
	const waiting: (string | null)[] = []
	const bundle = pictureBundle<string>(scheduler.schedule, (picture) => waiting.push(picture))
	const write = (pictures: string[], name: string) => bundle.add(pictures, async () => {
		written.push(name)
		return name
	})
	return { scheduler, written, waiting, bundle, write }
}

describe('pictureBundle', () => {
	// spec: XMP-003.25
	it('holds the writes of one picture until the user leaves it, then writes them in order', async () => {
		const { written, waiting, bundle, write } = bundled()

		const answers = [write(['A'], 'rate'), write(['A'], 'flag')]
		bundle.leave('A')
		expect(written).toEqual([])

		bundle.leave('B')
		expect(written).toEqual(['rate', 'flag'])
		expect(waiting).toEqual(['A', null])
		expect(await Promise.all(answers)).toEqual(['rate', 'flag'])
	})

	// spec: XMP-003.26
	it('writes after the idle time, which each further write starts again', () => {
		const { scheduler, written, write } = bundled()

		void write(['A'], 'rate')
		void write(['A'], 'flag')

		expect(scheduler.timers.map(({ ms, cancelled }) => [ms, cancelled])).toEqual([[BUNDLE_IDLE_MS, true], [BUNDLE_IDLE_MS, false]])
		expect(BUNDLE_IDLE_MS).toBe(2000)
		scheduler.fire()
		expect(written).toEqual(['rate', 'flag'])
	})

	// spec: XMP-003.27
	it('writes the waiting picture at once when another picture is written, and holds the other one', () => {
		const { scheduler, written, waiting, write } = bundled()

		void write(['A'], 'a')
		void write(['B'], 'b')

		expect(written).toEqual(['a'])
		expect(waiting).toEqual(['A', null, 'B'])
		expect(scheduler.timers.map(({ cancelled }) => cancelled)).toEqual([true, false])
	})

	// spec: XMP-003.27
	it('writes a write of several pictures, or of none, at once after the waiting one', () => {
		const { written, waiting, write } = bundled()

		void write(['A'], 'a')
		void write(['A', 'B'], 'both')
		void write([], 'none')

		expect(written).toEqual(['a', 'both', 'none'])
		expect(waiting).toEqual(['A', null])
	})

	// spec: XMP-003.29, XMP-003.30
	it('flushes the waiting picture and resolves once every write it started has settled, a failed one too', async () => {
		const scheduler = fakeScheduler()
		const settle: (() => void)[] = []
		const bundle = pictureBundle<string>(scheduler.schedule)
		const slow = () => new Promise<void>((resolve) => settle.push(resolve))
		void bundle.add(['A', 'B'], slow)
		const failed = bundle.add(['C'], async () => {
			throw new Error('down')
		})
		let flushed = false

		void bundle.flush().then(() => (flushed = true))
		await expect(failed).rejects.toThrow('down')
		await flushPromises()
		expect(flushed).toBe(false)

		settle[0]!()
		await flushPromises()
		expect(flushed).toBe(true)
		expect(scheduler.timers[0]!.cancelled).toBe(true)
	})

	it('flushes nothing and leaves nothing when nothing waits', async () => {
		const { written, waiting, bundle } = bundled()

		bundle.leave(null)
		await bundle.flush()

		expect(written).toEqual([])
		expect(waiting).toEqual([])
	})
})
