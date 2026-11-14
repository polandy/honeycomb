// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { usePrefetch } from '../../src/loupe-prefetch.ts'

/** A decoder whose loads the test settles by hand. */
function fakeDecoder() {
	const loads = new Map<string, { resolve: () => void, reject: (error: Error) => void }>()
	const started: string[] = []
	const decode = (src: string) => new Promise<void>((resolve, reject) => {
		started.push(src)
		loads.set(src, { resolve, reject })
	})
	return { decode, started, settle: (src: string) => loads.get(src)!.resolve(), fail: (src: string) => loads.get(src)!.reject(new Error('404')) }
}

describe('usePrefetch', () => {
	// spec: LOUPE-001.12
	it('loads the sources in order, each once, and marks them ready', async () => {
		const { decode, started, settle } = fakeDecoder()
		const prefetcher = usePrefetch(decode)

		prefetcher.prefetch(['a', 'b'], [])
		const again = prefetcher.load('a')
		settle('a')
		await again

		expect(started).toEqual(['a', 'b'])
		expect([...prefetcher.ready]).toEqual(['a'])
	})

	// spec: LOUPE-001.12, SERIES-002.1
	it('loads the shown picture and its neighbours, keeping its full image', () => {
		const { decode, started } = fakeDecoder()
		const prefetcher = usePrefetch(decode)
		const imagesAt = (index: number) => ({ loupe: `loupe${index}`, full: `full${index}` })

		prefetcher.prefetchAround(4, 6, imagesAt)
		prefetcher.load('full4').catch(() => undefined)
		prefetcher.prefetchAround(4, 6, imagesAt)

		expect(started).toEqual(['loupe4', 'loupe5', 'loupe3', 'loupe2', 'full4'])
	})

	it('forgets the sources outside the window but keeps the ones asked to', async () => {
		const { decode, started, settle } = fakeDecoder()
		const prefetcher = usePrefetch(decode)
		prefetcher.prefetch(['a', 'b'], ['full'])
		prefetcher.load('full').catch(() => undefined)
		settle('a')
		await flushPromises()

		prefetcher.prefetch(['b', 'c'], ['full'])
		prefetcher.prefetch(['a'], ['full'])

		expect(started).toEqual(['a', 'b', 'full', 'c', 'a'])
		expect(prefetcher.ready.has('a')).toBe(false)
	})

	// spec: LOUPE-001.12
	it('tries a failed load again next time', async () => {
		const { decode, started, fail } = fakeDecoder()
		const prefetcher = usePrefetch(decode)
		prefetcher.prefetch(['a'], [])
		fail('a')
		await flushPromises()

		await expect(Promise.race([prefetcher.load('a'), Promise.resolve('pending')])).resolves.toBe('pending')

		expect(started).toEqual(['a', 'a'])
		expect(prefetcher.ready.size).toBe(0)
	})
})
