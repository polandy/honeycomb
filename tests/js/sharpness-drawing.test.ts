// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'
import { measureSharpness } from '../../src/logic/sharpness.ts'
import { BAND_ROWS, measureFetched } from '../../src/sharpness-drawing.ts'

const WIDTH = 6
const HEIGHT = BAND_ROWS + 5

/** The decoded photo: noise from a fixed seed. */
const PIXELS = Uint8ClampedArray.from({ length: WIDTH * HEIGHT * 4 }, (_, index) => (index * 37 + (index >> 3) * 11) % 256)

/** A bitmap of the photo's size that records whether it was closed. */
function bitmap() {
	return { width: WIDTH, height: HEIGHT, close: vi.fn() }
}

/** A 2D context that reads back the rows of PIXELS last drawn. */
function context() {
	let top = 0
	let rows = 0
	return {
		drawImage: vi.fn((_image: unknown, _sx: number, sy: number, _sw: number, sh: number) => {
			top = sy
			rows = sh
		}),
		getImageData: vi.fn(() => ({ data: PIXELS.slice(top * WIDTH * 4, (top + rows) * WIDTH * 4) })),
	}
}

/** Worker seams that fetch `response`, decode it to `decoded` and draw in `drawn`. */
function seams(drawn: ReturnType<typeof context> | null, decoded = bitmap(), response = new Response(new Blob(['jpeg']))) {
	return {
		fetch: vi.fn(async () => response),
		decode: vi.fn(async () => decoded as unknown as ImageBitmap),
		canvas: vi.fn(() => ({ getContext: () => drawn }) as unknown as OffscreenCanvas),
	}
}

describe('measureFetched', () => {
	// spec: SERIES-006.19
	it('draws the fetched photo at full size in bands of rows and measures it', async () => {
		const drawn = context()
		const decoded = bitmap()
		const fake = seams(drawn, decoded)

		await expect(measureFetched('/loupe/5', fake)).resolves.toEqual(measureSharpness(PIXELS, WIDTH, HEIGHT))

		expect(fake.fetch).toHaveBeenCalledWith('/loupe/5')
		expect(fake.canvas).toHaveBeenCalledWith(WIDTH, BAND_ROWS)
		expect(drawn.drawImage.mock.calls).toEqual([[decoded, 0, 0, WIDTH, BAND_ROWS, 0, 0, WIDTH, BAND_ROWS], [decoded, 0, BAND_ROWS, WIDTH, 5, 0, 0, WIDTH, 5]])
		expect(drawn.getImageData.mock.calls).toEqual([[0, 0, WIDTH, BAND_ROWS], [0, 0, WIDTH, 5]])
		expect(decoded.close).toHaveBeenCalledOnce()
	})

	// spec: SERIES-006.19
	it('fails when the photo is missing', async () => {
		await expect(measureFetched('/loupe/5', seams(context(), bitmap(), new Response(null, { status: 404 })))).rejects.toThrow('Preview answered 404')
	})

	// spec: SERIES-006.19
	it('fails without a 2D canvas and still closes the bitmap', async () => {
		const decoded = bitmap()

		await expect(measureFetched('/loupe/5', seams(null, decoded))).rejects.toThrow('No 2D canvas')
		expect(decoded.close).toHaveBeenCalledOnce()
	})
})
