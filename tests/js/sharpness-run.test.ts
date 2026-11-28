// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SharpnessRunSeams } from '../../src/hashes/sharpness-run.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Sharpness, StoredQualityValue } from '../../src/logic/sharpness.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useSharpnessRun } from '../../src/hashes/sharpness-run.ts'
import { DEFAULT_PAIRING_SETTINGS } from '../../src/logic/pairing.ts'
import { deferred } from './hash-run-fakes.ts'
import { listingEntry } from './logic/listing-entries.ts'

vi.mock('../../src/shared/logger.ts', () => ({ logger: { warn: vi.fn() } }))

/** A series A–B without values, a series C–D with a value of method 1 and of method 2, A's RAW, and the single photo E. */
const TREE = [
	listingEntry(1, '/P/A.JPG', { captureTime: 0 }),
	listingEntry(11, '/P/A.CR3', { captureTime: 0, mime: 'image/x-canon-cr3' }),
	listingEntry(2, '/P/2026/B.JPG', { captureTime: 1 }),
	listingEntry(3, '/P/C.JPG', { captureTime: 100, quality: { method: 1, sharpness: 50, focusTile: 4 } }),
	listingEntry(4, '/P/D.JPG', { captureTime: 101, quality: { method: 2, sharpness: 50, focusTile: 4 } }),
	listingEntry(5, '/P/E.JPG', { captureTime: 500 }),
]

/** Seams listing `entries`, measuring through promises the test settles in call order and keeping every save. */
function seams(entries: readonly ListingEntry[] = TREE, overrides: Partial<SharpnessRunSeams> = {}) {
	const measures: { member: ListingEntry, resolve: (value: Sharpness) => void, reject: (error: Error) => void }[] = []
	const saves: StoredQualityValue[][] = []
	const fake = {
		listTree: vi.fn(async (_path: string) => entries),
		pairing: vi.fn(async () => DEFAULT_PAIRING_SETTINGS),
		measureImage: (member: ListingEntry) => new Promise<Sharpness>((resolve, reject) => measures.push({ member, resolve, reject })),
		saveQualityValues: async (values: readonly StoredQualityValue[]) => {
			saves.push([...values])
		},
		wait: async () => {},
		...overrides,
	}
	return { fake, measures, saves }
}

/** Settles each measure from `from` on, asked so far and those it leads to, in turn. */
async function measureAll(measures: ReturnType<typeof seams>['measures'], from = 0) {
	for (let index = from; index < measures.length; index++) {
		measures[index]!.resolve({ sharpness: 10 + index, focusTile: index })
		await flushPromises()
	}
}

const fileIds = (measures: ReturnType<typeof seams>['measures']) => measures.map((measure) => measure.member.fileId)

describe('useSharpnessRun', () => {
	// spec: SERIES-004.17
	it('measures the shown series members without a current value, one at a time, and saves them', async () => {
		const { fake, measures, saves } = seams()
		const run = useSharpnessRun(fake)

		run.start('/P')
		await flushPromises()
		expect(fake.listTree).toHaveBeenCalledWith('/P')
		expect(fileIds(measures)).toEqual([1])

		await measureAll(measures)

		expect(fileIds(measures)).toEqual([1, 2, 4])
		expect(saves.flat()).toEqual([
			{ fileId: 1, etag: 'etag-1', method: 1, sharpness: 10, focusTile: 0 },
			{ fileId: 2, etag: 'etag-2', method: 1, sharpness: 11, focusTile: 1 },
			{ fileId: 4, etag: 'etag-4', method: 1, sharpness: 12, focusTile: 2 },
		])
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.18
	it('counts the photos to measure, measured, failed and left', async () => {
		const { fake, measures } = seams()
		const run = useSharpnessRun(fake)
		expect(run.progress.value).toEqual({ total: 0, measured: 0, failed: 0 })

		run.start('/P')
		await flushPromises()
		expect(run.status.value).toBe('running')
		expect(run.progress.value).toEqual({ total: 3, measured: 0, failed: 0 })
		measures[0]!.resolve({ sharpness: 1, focusTile: 0 })
		await flushPromises()
		measures[1]!.reject(new Error('no preview'))
		await flushPromises()

		expect(run.progress.value).toEqual({ total: 3, measured: 1, failed: 1 })
		expect(run.status.value).toBe('running')
	})

	// spec: SERIES-004.18
	it('is done at once for a tree without a series', async () => {
		const { fake, measures } = seams([TREE[5]!])
		const run = useSharpnessRun(fake)

		run.start('/P')
		await flushPromises()

		expect(measures).toHaveLength(0)
		expect(run.progress.value).toEqual({ total: 0, measured: 0, failed: 0 })
		expect(run.status.value).toBe('done')
	})

	// spec: SERIES-004.19
	it('finishes the photo in work on pause, measures no further one and goes on with resume', async () => {
		const { fake, measures } = seams()
		const run = useSharpnessRun(fake)
		run.start('/P')
		await flushPromises()

		run.pause()
		expect(run.status.value).toBe('paused')
		measures[0]!.resolve({ sharpness: 1, focusTile: 0 })
		await flushPromises()
		expect(fileIds(measures)).toEqual([1])
		expect(run.progress.value.measured).toBe(1)

		run.resume()
		await flushPromises()
		expect(fileIds(measures)).toEqual([1, 2])
		expect(run.status.value).toBe('running')
	})

	// spec: SERIES-004.19
	it('starts nothing when a listing arrives while paused', async () => {
		const listing = deferred<readonly ListingEntry[]>()
		const { fake, measures } = seams(TREE, { listTree: vi.fn(() => listing.promise) })
		const run = useSharpnessRun(fake)
		run.start('/P')
		run.pause()

		listing.resolve(TREE)
		await flushPromises()
		expect(measures).toHaveLength(0)
		expect(run.status.value).toBe('paused')

		run.resume()
		await flushPromises()
		expect(fake.listTree).toHaveBeenCalledTimes(1)
		expect(fileIds(measures)).toEqual([1])
	})

	// spec: SERIES-004.20
	it('pauses on a failed listing and lists again on resume', async () => {
		const listTree = vi.fn<(path: string) => Promise<readonly ListingEntry[]>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(TREE)
		const { fake, measures } = seams(TREE, { listTree })
		const run = useSharpnessRun(fake)

		run.start('/P')
		await flushPromises()
		expect(run.status.value).toBe('paused')
		expect(run.problem.value).toBe(true)
		expect(measures).toHaveLength(0)

		run.resume()
		await flushPromises()
		expect(run.problem.value).toBe(false)
		expect(listTree.mock.calls).toEqual([['/P'], ['/P']])
		expect(fileIds(measures)).toEqual([1])
	})

	// spec: SERIES-004.20
	it('pauses when the pairing settings cannot be loaded', async () => {
		const { fake, measures } = seams(TREE, { pairing: vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(DEFAULT_PAIRING_SETTINGS) })
		const run = useSharpnessRun(fake)

		run.start('/P')
		await flushPromises()
		expect(run.status.value).toBe('paused')
		expect(run.problem.value).toBe(true)

		run.resume()
		await flushPromises()
		expect(fileIds(measures)).toEqual([1])
	})

	// spec: SERIES-004.21
	it('does not measure a failed photo again when the same folder runs again', async () => {
		const { fake, measures } = seams()
		const run = useSharpnessRun(fake)
		run.start('/P')
		await flushPromises()
		measures[0]!.reject(new Error('no preview'))
		await flushPromises()
		await measureAll(measures, 1)
		expect(fileIds(measures)).toEqual([1, 2, 4])
		expect(run.status.value).toBe('done')

		run.start('/P')
		await flushPromises()

		expect(fileIds(measures)).toEqual([1, 2, 4])
		expect(run.progress.value).toEqual({ total: 0, measured: 0, failed: 0 })
		expect(run.status.value).toBe('done')
	})
})
