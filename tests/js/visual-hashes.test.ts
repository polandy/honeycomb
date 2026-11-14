// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { imageUrl } from '../../src/api.ts'
import { APP_SEAMS } from '../../src/app-seams.ts'
import { logger } from '../../src/logger.ts'
import { GRID_TIERS, smallSource } from '../../src/logic/image-tiers.ts'
import { HASH_COLUMNS, HASH_ROWS } from '../../src/logic/visual-hash.ts'
import { hashPreview, VISUAL_HASHES_KEY } from '../../src/visual-hashes.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'
import { BURST, setUp } from './visual-hash-fakes.ts'

afterEach(() => vi.restoreAllMocks())

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

	// spec: SERIES-003.21
	it('hashes a RAW-only picture by its RAW and a pair by its JPEG', async () => {
		const { calls } = setUp()
		calls[0]!.resolve('0000000000000001')
		await flushPromises()

		expect(calls.map((call) => call.member.path)).toEqual(['/P/A.JPG', '/P/B.CR3'])
	})

	// spec: SERIES-003.13
	it('logs a failed save and keeps the hashes for this visit', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => {})
		const { calls, hashes, byName } = setUp(BURST, {}, true)
		calls[0]!.resolve('0000000000000001')
		await flushPromises()
		calls[1]!.resolve('0000000000000003')
		await flushPromises()

		expect(warn).toHaveBeenCalledWith('Could not save the visual hashes', expect.objectContaining({ count: 2 }))
		expect(hashes.hashOf(byName('A'))).toBe('0000000000000001')
		expect(hashes.progress.value.phase).toBe('failed')
	})

	// spec: SERIES-003.14
	it('removes the hashes earlier versions kept in browser storage and ignores them', () => {
		const { calls, stored } = setUp(BURST, { [VISUAL_HASHES_KEY]: JSON.stringify({ '1:etag-1': '0000000000000001' }) })

		expect(stored[VISUAL_HASHES_KEY]).toBeUndefined()
		expect(calls.map((call) => call.member.fileId)).toEqual([1])
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

	// spec: SERIES-003.22
	it('loads the very URL the grid tile loads first, so the browser cache serves it', async () => {
		const sources = stubCanvas({ drawImage: vi.fn(), getImageData: () => ({ data: new Uint8ClampedArray(HASH_COLUMNS * HASH_ROWS * 4) }) })
		const member = listingEntry(5, '/P/A.JPG', { mtime: 9 })
		await APP_SEAMS.hashImage(member)

		expect(sources).toEqual([smallSource(member, imageUrl)])
	})

	it('fails without a 2D canvas', async () => {
		stubCanvas(null)

		await expect(hashPreview(() => '/preview')(listingEntry(5, '/P/A.JPG'))).rejects.toThrow('No 2D canvas')
	})
})
