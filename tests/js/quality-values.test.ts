// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Sharpness, StoredQualityValue } from '../../src/logic/sharpness.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref, shallowRef } from 'vue'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { LOUPE_TIER } from '../../src/logic/image-tiers.ts'
import { RateLimitedError } from '../../src/logic/retry-after.ts'
import { NO_STORED_ROWS } from '../../src/logic/stored-series.ts'
import { measureInWorkers, useQualityValues } from '../../src/quality-values.ts'
import { useSeries } from '../../src/series.ts'
import { fakeStorage } from './app-cull.ts'
import { deferred } from './hash-run-fakes.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'
import { fakeHasher } from './visual-hash-fakes.ts'

afterEach(() => vi.restoreAllMocks())

/** A measurer whose values the test settles one by one, in call order. */
function fakeMeasurer() {
	const measures: { member: ListingEntry, resolve: (value: Sharpness) => void, reject: (error: Error) => void }[] = []
	const measureImage = (member: ListingEntry) => new Promise<Sharpness>((resolve, reject) => measures.push({ member, resolve, reject }))
	return { measures, measureImage }
}

/** A save that keeps what it was sent and meets the failures in turn. */
function fakeSave(failures: Error[] | 'always' = []) {
	const saves: StoredQualityValue[][] = []
	const saveQualityValues = async (values: readonly StoredQualityValue[]) => {
		saves.push([...values])
		const failure = failures === 'always' ? new Error('offline') : failures.shift()
		if (failure !== undefined) {
			throw failure
		}
	}
	return { saves, saveQualityValues }
}

/** Two series, A–B without values and C–D with values of method 1 and 2, and the single picture E. */
const CULL = [
	listingEntry(1, '/P/A.JPG', { captureTime: 0 }),
	listingEntry(2, '/P/B.JPG', { captureTime: 1 }),
	listingEntry(3, '/P/C.JPG', { captureTime: 100, quality: { method: 1, sharpness: 50, focusTile: 4 } }),
	listingEntry(4, '/P/D.JPG', { captureTime: 101, quality: { method: 2, sharpness: 50, focusTile: 4 } }),
	listingEntry(5, '/P/E.JPG', { captureTime: 500 }),
]

/** The series of `entries` with a hasher and a measurer the test settles. */
function seriesOf(entries: ListingEntry[]) {
	const hasher = fakeHasher()
	const measurer = fakeMeasurer()
	const save = fakeSave()
	const pictures = shallowRef<Picture<ListingEntry>[]>(picturesOf(entries))
	const series = useSeries({ hashImage: hasher.hashImage, saveVisualHashes: async () => undefined, measureImage: measurer.measureImage, saveQualityValues: save.saveQualityValues, wait: async () => {} }, fakeStorage(), () => pictures.value, () => UNDECIDED, () => NO_STORED_ROWS)
	const byName = (name: string) => pictures.value.find((picture) => picture.baseName === name)!
	/** Settles every hash asked so far and those it leads to, all alike, so the series follow capture time. */
	async function hashAll() {
		for (let index = 0; index < hasher.calls.length; index++) {
			hasher.calls[index]!.resolve('0000000000000000')
			await flushPromises()
		}
	}
	return { ...measurer, ...save, hasher, series, pictures, byName, hashAll }
}

describe('useSeries measuring quality values', () => {
	// spec: SERIES-006.16
	it('measures nothing while a visual hash is pending', async () => {
		const { measures, hasher, hashAll } = seriesOf(CULL)
		await flushPromises()

		expect(hasher.calls.length).toBeGreaterThan(0)
		expect(measures).toHaveLength(0)
		await hashAll()
		expect(measures).toHaveLength(1)
	})

	// spec: SERIES-006.15
	it('measures the series members without a value of method 1, one at a time in tile order, and no single picture', async () => {
		const { measures, hashAll, series, byName } = seriesOf(CULL)
		await hashAll()

		expect(measures.map((measure) => measure.member.fileId)).toEqual([1])
		measures[0]!.resolve({ sharpness: 812.4, focusTile: 27 })
		await flushPromises()
		measures[1]!.resolve({ sharpness: 90, focusTile: 3 })
		await flushPromises()
		measures[2]!.resolve({ sharpness: 70, focusTile: 2 })
		await flushPromises()

		expect(measures.map((measure) => measure.member.fileId)).toEqual([1, 2, 4])
		expect(series.qualityOf(byName('A'))).toEqual({ method: 1, sharpness: 812.4, focusTile: 27 })
		expect(series.qualityOf(byName('C'))).toEqual({ method: 1, sharpness: 50, focusTile: 4 })
		expect(series.qualityOf(byName('D'))).toEqual({ method: 1, sharpness: 70, focusTile: 2 })
		expect(series.qualityOf(byName('E'))).toBeNull()
	})

	// spec: SERIES-006.18
	it('saves the values once none is left to measure', async () => {
		const { measures, saves, hashAll } = seriesOf(CULL.slice(0, 2))
		await hashAll()
		measures[0]!.resolve({ sharpness: 812.4, focusTile: 27 })
		await flushPromises()
		expect(saves).toHaveLength(0)
		measures[1]!.resolve({ sharpness: 90, focusTile: 3 })
		await flushPromises()

		expect(saves).toEqual([[
			{ fileId: 1, etag: 'etag-1', method: 1, sharpness: 812.4, focusTile: 27 },
			{ fileId: 2, etag: 'etag-2', method: 1, sharpness: 90, focusTile: 3 },
		]])
	})
})

/** `useQualityValues` over members the test sets, ready or not. */
function setUp(entries: ListingEntry[], failures: Error[] | 'always' = [], wait = async (_seconds: number) => {}, initiallyReady = true) {
	const measurer = fakeMeasurer()
	const save = fakeSave(failures)
	const members = shallowRef<ListingEntry[]>(entries)
	const ready = ref(initiallyReady)
	const quality = useQualityValues({ measureImage: measurer.measureImage, saveQualityValues: save.saveQualityValues, wait }, () => members.value, () => ready.value)
	return { ...measurer, ...save, members, ready, quality }
}

/** Settles every measure in turn with the same value. */
async function measureAll(measures: ReturnType<typeof fakeMeasurer>['measures']) {
	for (let index = 0; index < measures.length; index++) {
		measures[index]!.resolve({ sharpness: index, focusTile: 0 })
		await flushPromises()
	}
}

describe('useQualityValues', () => {
	// spec: SERIES-006.17
	it('logs a failed measure and does not measure that file version again, but a new one', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const a = listingEntry(1, '/P/A.JPG')
		const { measures, members, quality } = setUp([a])
		measures[0]!.reject(new Error('decode failed'))
		await flushPromises()
		expect(warn).toHaveBeenCalledWith('Could not measure the photo', expect.objectContaining({ fileId: 1 }))

		members.value = [a]
		await flushPromises()
		expect(measures).toHaveLength(1)
		expect(quality.qualityOf(a)).toBeNull()

		members.value = [{ ...a, etag: 'etag-new' }]
		await flushPromises()
		expect(measures).toHaveLength(2)
	})

	// spec: SERIES-006.16
	it('starts once ready', async () => {
		const { measures, ready } = setUp([listingEntry(1, '/P/A.JPG')], [], async () => {}, false)
		await flushPromises()
		expect(measures).toHaveLength(0)

		ready.value = true
		await flushPromises()
		expect(measures).toHaveLength(1)
	})

	// spec: SERIES-006.18
	it('saves every 100 values while measuring goes on and the rest at the end', async () => {
		const entries = Array.from({ length: 101 }, (_, index) => listingEntry(index + 1, `/P/${index}.JPG`))
		const { measures, saves } = setUp(entries)
		for (let index = 0; index < 100; index++) {
			measures[index]!.resolve({ sharpness: index, focusTile: 0 })
			await flushPromises()
		}
		expect(saves.map((save) => save.length)).toEqual([100])

		measures[100]!.resolve({ sharpness: 100, focusTile: 0 })
		await flushPromises()
		expect(saves.map((save) => save.length)).toEqual([100, 1])
	})

	// spec: SERIES-006.18
	it('logs a failed save and keeps the values for this visit', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const a = listingEntry(1, '/P/A.JPG')
		const { measures, quality } = setUp([a], 'always')
		await measureAll(measures)

		expect(warn).toHaveBeenCalledWith('Could not save the quality values', expect.objectContaining({ count: 1 }))
		expect(quality.qualityOf(a)).toEqual({ method: 1, sharpness: 0, focusTile: 0 })
	})

	// spec: SERIES-006.18
	it('waits as long as a limited save asks and sends the same values again', async () => {
		const waited = deferred<void>()
		const wait = vi.fn(() => waited.promise)
		const { measures, saves } = setUp([listingEntry(1, '/P/A.JPG')], [new RateLimitedError(42)], wait)
		await measureAll(measures)
		expect(wait).toHaveBeenCalledWith(42)

		waited.resolve()
		await flushPromises()
		expect(saves.map((save) => save.map((each) => each.fileId))).toEqual([[1], [1]])
	})

	it('gives the listed value of method 1 and measures none of it', () => {
		const a = listingEntry(1, '/P/A.JPG', { quality: { method: 1, sharpness: 5, focusTile: 1 } })
		const { measures, quality } = setUp([a])

		expect(measures).toHaveLength(0)
		expect(quality.qualityOf(a)).toEqual({ method: 1, sharpness: 5, focusTile: 1 })
	})
})

describe('measureInWorkers', () => {
	// spec: SERIES-006.19
	it('measures the loupe tier of the member in the pool', async () => {
		const measure = vi.fn(async () => ({ sharpness: 3, focusTile: 1 }))
		const measureImage = measureInWorkers({ measure }, (fileId, size, mtime) => `/preview/${fileId}/${size}/${mtime}`)

		await expect(measureImage(listingEntry(5, '/P/A.JPG', { mtime: 9 }))).resolves.toEqual({ sharpness: 3, focusTile: 1 })
		expect(measure).toHaveBeenCalledWith('sharpness', `/preview/5/${LOUPE_TIER}/9`)
	})
})
