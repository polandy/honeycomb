// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { logger } from '../../src/logger.ts'
import { useVisualHashes } from '../../src/visual-hashes.ts'
import { fakeStorage } from './app-cull.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'
import { BURST, fakeHasher, setUp } from './visual-hash-fakes.ts'

afterEach(() => vi.restoreAllMocks())

describe('useVisualHashes states and progress', () => {
	// spec: SERIES-003.16
	it('knows of each hashable picture whether it is hashed, pending or failed', async () => {
		vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes, byName } = setUp([{ ...BURST[0]!, visualHash: '00000000000000aa' }, ...BURST.slice(1), listingEntry(5, '/P/D.JPG', { captureTime: 12 })])
		expect([hashes.stateOf(byName('A')), hashes.stateOf(byName('B')), hashes.stateOf(byName('D')), hashes.stateOf(byName('C'))]).toEqual(['hashed', 'pending', 'pending', null])

		calls[0]!.reject(new Error('no preview'))
		await flushPromises()
		expect([hashes.stateOf(byName('B')), hashes.stateOf(byName('D'))]).toEqual(['failed', 'pending'])
		calls[1]!.resolve('0000000000000005')
		await flushPromises()

		expect(hashes.stateOf(byName('D'))).toBe('hashed')
	})

	// spec: SERIES-003.18, SERIES-003.19
	it('counts the progress of the hashable pictures and reports the failed', async () => {
		vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes } = setUp()
		expect(hashes.progress.value).toEqual({ phase: 'running', hashed: 0, failed: 0, total: 2 })
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		expect(hashes.progress.value).toEqual({ phase: 'running', hashed: 1, failed: 0, total: 2 })
		calls[1]!.reject(new Error('no preview'))
		await flushPromises()

		expect(hashes.progress.value).toEqual({ phase: 'failed', hashed: 1, failed: 1, total: 2 })
	})

	// spec: SERIES-003.18
	it('counts a hash held back from the series as hashed', async () => {
		const { calls, hashes } = setUp()
		hashes.hold(true)
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(hashes.progress.value.hashed).toBe(1)
	})

	// spec: SERIES-003.20
	it('is done once every hashable picture is hashed and saved', async () => {
		const { calls, hashes } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()

		expect(hashes.progress.value.phase).toBe('done')
	})

	// spec: SERIES-003.17
	it('does not hash a failed file version again in this visit, but a new version', async () => {
		vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, pictures } = setUp()
		calls[0]!.reject(new Error('no preview'))
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()
		pictures.value = picturesOf([...BURST])
		await flushPromises()
		expect(calls).toHaveLength(2)

		pictures.value = picturesOf([{ ...BURST[0]!, etag: 'etag-new' }, ...BURST.slice(1)])
		await flushPromises()
		expect(calls.map((call) => call.member.fileId)).toEqual([1, 3, 1])
	})

	// spec: SERIES-001.17, SERIES-003.12
	it('saves the computed hashes with their etags once none is left to hash', async () => {
		const { calls, saves } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		expect(saves).toEqual([])
		calls[1]!.resolve('0000000000000003')
		await flushPromises()

		expect(saves).toEqual([[{ fileId: 1, etag: 'etag-1', hash: '0000000000000001' }, { fileId: 3, etag: 'etag-3', hash: '0000000000000003' }]])
	})

	// spec: SERIES-003.12
	it('saves every 100 hashes while hashing goes on', async () => {
		const { calls, saves } = setUp(Array.from({ length: 101 }, (_, index) => listingEntry(index + 1, `/P/${index}.JPG`, { captureTime: index })))
		for (let index = 0; index < 101; index++) {
			calls[index]!.resolve('0000000000000000')
			await flushPromises()
		}

		expect(saves.map((batch) => batch.length)).toEqual([100, 1])
	})

	// spec: SERIES-001.17, SERIES-003.12
	it('uses the hashes the listing delivered at once and hashes only the rest', async () => {
		const { calls, saves, hashes, byName } = setUp([{ ...BURST[0]!, visualHash: '00000000000000aa' }, ...BURST.slice(1)])

		expect(hashes.hashOf(byName('A'))).toBe('00000000000000aa')
		expect(calls.map((call) => call.member.fileId)).toEqual([3])
		calls[0]!.resolve('0000000000000003')
		await flushPromises()
		expect(saves).toEqual([[{ fileId: 3, etag: 'etag-3', hash: '0000000000000003' }]])
	})

	// spec: SERIES-001.17
	it('hashes a file again once its etag changed', async () => {
		const { calls, pictures } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()
		pictures.value = picturesOf([{ ...BURST[0]!, etag: 'etag-new' }, ...BURST.slice(1)])
		await flushPromises()

		expect(calls.map((call) => call.member.fileId)).toEqual([1, 3, 1])
	})

	// spec: SERIES-003.19
	it('clears the failed save once a later save succeeds', async () => {
		vi.spyOn(logger, 'warn').mockImplementation(() => {})
		let fails = true
		const hasher = fakeHasher()
		const pictures = shallowRef(picturesOf(BURST))
		const hashes = useVisualHashes({ hashImage: hasher.hashImage, saveVisualHashes: async () => {
			if (fails) {
				throw new Error('offline')
			}
		} }, fakeStorage({}), () => pictures.value)
		hasher.calls[0]!.resolve('0000000000000001')
		await flushPromises()
		hasher.calls[1]!.resolve('0000000000000003')
		await flushPromises()
		expect(hashes.progress.value.phase).toBe('failed')

		fails = false
		pictures.value = picturesOf([{ ...BURST[0]!, etag: 'etag-new' }, ...BURST.slice(1)])
		await flushPromises()
		hasher.calls[2]!.resolve('0000000000000002')
		await flushPromises()
		expect(hashes.progress.value.phase).toBe('done')
	})
})
