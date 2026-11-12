// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { shallowRef } from 'vue'
import { logger } from '../../src/logger.ts'
import { GRID_TIERS } from '../../src/logic/image-tiers.ts'
import { HASH_COLUMNS, HASH_ROWS } from '../../src/logic/visual-hash.ts'
import { hashPreview, useVisualHashes, VISUAL_HASHES_KEY } from '../../src/visual-hashes.ts'
import { fakeStorage } from './app-cull.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

const BURST = [
	listingEntry(1, '/P/A.JPG', { captureTime: 0 }),
	listingEntry(2, '/P/A.CR3', { captureTime: 0, mime: 'image/x-dcraw' }),
	listingEntry(3, '/P/B.CR3', { captureTime: 10, mime: 'image/x-dcraw' }),
	listingEntry(4, '/P/C.JPG', { captureTime: 500 }),
]

/** A hasher whose hashes the test settles one by one, in call order. */
function fakeHasher() {
	const calls: { member: ListingEntry, resolve: (hash: string) => void, reject: (error: Error) => void }[] = []
	const hashImage = (member: ListingEntry) => new Promise<string>((resolve, reject) => calls.push({ member, resolve, reject }))
	return { calls, hashImage }
}

function setUp(stored: Record<string, string> = {}) {
	const hasher = fakeHasher()
	const pictures = shallowRef<Picture<ListingEntry>[]>(picturesOf(BURST))
	const hashes = useVisualHashes(hasher.hashImage, fakeStorage(stored), () => pictures.value)
	const byName = (name: string) => pictures.value.find((picture) => picture.baseName === name)!
	return { ...hasher, pictures, hashes, byName, stored }
}

describe('useVisualHashes', () => {
	// spec: SERIES-001.17
	it('hashes the shown member of each picture that could form a series, one at a time', async () => {
		const { calls, hashes, byName } = setUp()

		expect(calls.map((call) => call.member.fileId)).toEqual([1])
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
		expect(calls.map((call) => call.member.fileId)).toEqual([1, 3])
		expect(hashes.hashOf(byName('C'))).toBeNull()
	})

	// spec: SERIES-001.17
	it('stores the hashes once all are done and reuses them for the same file version', async () => {
		const { calls, stored } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		expect(stored[VISUAL_HASHES_KEY]).toBeUndefined()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()

		const again = setUp({ [VISUAL_HASHES_KEY]: stored[VISUAL_HASHES_KEY]! })
		expect(again.calls).toEqual([])
		expect(again.hashes.hashOf(again.byName('B'))).toBe('0000000000000003')
	})

	// spec: SERIES-001.17
	it('hashes a file again once its etag changed', () => {
		const { calls } = setUp({ [VISUAL_HASHES_KEY]: JSON.stringify({ '1:etag-1': '0000000000000001', '3:old': '0000000000000003' }) })

		expect(calls.map((call) => call.member.fileId)).toEqual([3])
	})

	// spec: SERIES-001.16, SERIES-001.17
	it('logs a failed hash, leaves that picture without one and goes on', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes, byName } = setUp()
		calls[0]!.reject(new Error('decode failed'))
		await flushPromises()

		expect(warn).toHaveBeenCalledWith('Could not hash the preview', expect.objectContaining({ fileId: 1 }))
		expect(hashes.hashOf(byName('A'))).toBeNull()
		expect(calls).toHaveLength(2)
	})

	// spec: SERIES-001.17
	it('hashes the pictures newly shown instead of the old ones', async () => {
		const { calls, pictures } = setUp()
		pictures.value = picturesOf([listingEntry(7, '/Q/X.JPG', { captureTime: 0 }), listingEntry(8, '/Q/Y.JPG', { captureTime: 1 })])
		await flushPromises()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(calls.map((call) => call.member.fileId)).toEqual([1, 7])
	})

	// spec: SERIES-001.18
	it('holds new hashes back while held and shows them on release', async () => {
		const { calls, hashes, byName } = setUp()
		hashes.hold(true)
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		expect(hashes.hashOf(byName('A'))).toBeNull()

		hashes.hold(false)
		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
	})
})

describe('hashPreview', () => {
	afterEach(() => vi.unstubAllGlobals())

	/** Stubs the browser's image decoding and canvas with one that reads `context`. */
	function stubCanvas(context: object | null) {
		const sources: string[] = []
		vi.stubGlobal('Image', class {
			set src(value: string) {
				sources.push(value)
			}

			async decode() {}
		})
		vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as CanvasRenderingContext2D)
		return sources
	}

	// spec: SERIES-001.17
	it('hashes the small grid tier of the member, drawn at the hash size', async () => {
		const drawImage = vi.fn()
		const sources = stubCanvas({ drawImage, getImageData: () => ({ data: new Uint8ClampedArray(HASH_COLUMNS * HASH_ROWS * 4) }) })
		const hash = await hashPreview((fileId, size, mtime) => `/preview/${fileId}/${size}/${mtime}`)(listingEntry(5, '/P/A.JPG', { mtime: 9 }))

		expect(hash).toBe('0000000000000000')
		expect(sources).toEqual([`/preview/5/${GRID_TIERS[0]}/9`])
		expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, HASH_COLUMNS, HASH_ROWS)
	})

	it('fails without a 2D canvas', async () => {
		stubCanvas(null)

		await expect(hashPreview(() => '/preview')(listingEntry(5, '/P/A.JPG'))).rejects.toThrow('No 2D canvas')
	})
})
