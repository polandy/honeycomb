// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { hashFetched } from '../../src/hash-drawing.ts'
import { differenceHash, HASH_COLUMNS, HASH_ROWS } from '../../src/logic/visual-hash.ts'

const PIXELS = Uint8ClampedArray.from({ length: HASH_COLUMNS * HASH_ROWS * 4 }, (_, index) => (index * 37) % 256)
const BITMAP = { width: 256, height: 171 }

/** A 2D context that reads back PIXELS whatever is drawn. */
function context() {
	return { imageSmoothingQuality: 'low', drawImage: vi.fn(), getImageData: vi.fn(() => ({ data: PIXELS })) }
}

/** Worker seams that fetch `response`, decode it to BITMAP and draw in `drawn`. */
function seams(drawn: ReturnType<typeof context> | null, response = new Response(new Blob(['jpeg']))) {
	return {
		fetch: vi.fn(async () => response),
		decode: vi.fn(async () => BITMAP as unknown as ImageBitmap),
		canvas: vi.fn(() => ({ getContext: () => drawn }) as unknown as OffscreenCanvas),
	}
}

describe('hashFetched', () => {
	// spec: SERIES-004.7
	it('draws the fetched preview at the hash size, smoothed like the grid, and hashes it', async () => {
		const drawn = context()
		const fake = seams(drawn)

		const hash = await hashFetched('/preview/5', fake)

		expect(hash).toBe(differenceHash(PIXELS))
		expect(fake.fetch).toHaveBeenCalledWith('/preview/5')
		expect(fake.canvas).toHaveBeenCalledWith(HASH_COLUMNS, HASH_ROWS)
		expect(drawn.drawImage).toHaveBeenCalledWith(BITMAP, 0, 0, HASH_COLUMNS, HASH_ROWS)
		expect(drawn.imageSmoothingQuality).toBe('high')
	})

	// spec: SERIES-004.10
	it('fails when the preview is missing', async () => {
		await expect(hashFetched('/preview/5', seams(context(), new Response(null, { status: 404 })))).rejects.toThrow('Preview answered 404')
	})

	it('fails without a 2D canvas', async () => {
		await expect(hashFetched('/preview/5', seams(null))).rejects.toThrow('No 2D canvas')
	})
})
