// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { measureSharpness, sharpestOf, sharpnessMeter } from '../../../src/logic/sharpness.ts'

/** An RGBA photo of `width` × `height` whose grey value at each pixel is `grey(x, y)`. */
function photo(width: number, height: number, grey: (x: number, y: number) => number) {
	const rgba = new Uint8ClampedArray(width * height * 4)
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			rgba.set([grey(x, y), grey(x, y), grey(x, y), 255], (y * width + x) * 4)
		}
	}
	return rgba
}

/** A checkerboard of 2-pixel squares, black and white. */
const checker = (x: number, y: number) => ((Math.floor(x / 2) + Math.floor(y / 2)) % 2) * 255

/** The checkerboard blurred by a 3×3 box, clamped at the edge. */
function blurredChecker(size: number) {
	return (x: number, y: number) => {
		let sum = 0
		for (let dy = -1; dy <= 1; dy++) {
			for (let dx = -1; dx <= 1; dx++) {
				sum += checker(Math.min(size - 1, Math.max(0, x + dx)), Math.min(size - 1, Math.max(0, y + dy)))
			}
		}
		return Math.round(sum / 9)
	}
}

/** A 24 × 24 black photo, tiles of 3 × 3 pixels, with a white dot at the centre of each inner tile given. */
function dots(...tiles: number[]) {
	const centres = new Set(tiles.map((tile) => `${(tile % 8) * 3 + 1},${Math.floor(tile / 8) * 3 + 1}`))
	return photo(24, 24, (x, y) => (centres.has(`${x},${y}`) ? 255 : 0))
}

/** The variance of one dot's Laplacian over its tile's nine pixels: −4·255 once, 255 four times, 0 four times. */
const DOT_VARIANCE = (20 * 255 * 255) / 9

/** A noisy photo from a fixed seed. */
function noise(width: number, height: number) {
	let seed = 7
	return photo(width, height, () => {
		seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648
		return seed % 256
	})
}

describe('measureSharpness', () => {
	// spec: SERIES-006.1
	it('measures a sharp photo higher than its blurred copy, and a flat one 0', () => {
		const sharp = measureSharpness(photo(64, 64, checker), 64, 64)
		const blurred = measureSharpness(photo(64, 64, blurredChecker(64)), 64, 64)

		expect(sharp.sharpness).toBeGreaterThan(blurred.sharpness * 2)
		expect(blurred.sharpness).toBeGreaterThan(0)
		expect(measureSharpness(photo(64, 64, () => 128), 64, 64)).toEqual({ sharpness: 0, focusTile: 0 })
	})

	// spec: SERIES-006.2
	it('counts the best seven of the 64 tiles and names the best one as the focus tile', () => {
		const one = measureSharpness(dots(28), 24, 24)
		expect(one.focusTile).toBe(28)
		expect(one.sharpness).toBeCloseTo(DOT_VARIANCE / 7, 3)

		const seven = measureSharpness(dots(9, 18, 20, 27, 33, 41, 50), 24, 24)
		expect(seven.sharpness).toBeCloseTo(DOT_VARIANCE, 3)
		expect(measureSharpness(dots(9, 18, 20, 27, 33, 41, 50, 54), 24, 24).sharpness).toBeCloseTo(DOT_VARIANCE, 3)
	})

	it('weighs the colours as grey, 0.299 red, 0.587 green and 0.114 blue', () => {
		const red = new Uint8ClampedArray(24 * 24 * 4)
		red.set([255, 0, 0, 255], (10 * 24 + 13) * 4)

		expect(measureSharpness(red, 24, 24).sharpness).toBeCloseTo((DOT_VARIANCE * 0.299 * 0.299) / 7, 3)
	})

	// spec: SERIES-006.4
	it('refuses a photo narrower or lower than 3 pixels', () => {
		expect(() => measureSharpness(photo(2, 9, checker), 2, 9)).toThrow(RangeError)
		expect(() => sharpnessMeter(9, 2)).toThrow(RangeError)
	})

	it('measures a photo of exactly 3 pixels, its one inner pixel in its tile', () => {
		expect(measureSharpness(photo(3, 3, (x, y) => (x === 1 && y === 1 ? 255 : 0)), 3, 3)).toEqual({ sharpness: 0, focusTile: 0 })
	})
})

describe('sharpnessMeter', () => {
	// spec: SERIES-006.3
	it('gives the same value for any bands, top to bottom', () => {
		const rgba = noise(40, 30)
		const whole = measureSharpness(rgba, 40, 30)
		const meter = sharpnessMeter(40, 30)
		let top = 0
		for (const rows of [7, 1, 22]) {
			meter.addBand(top, rows, rgba.subarray(top * 40 * 4, (top + rows) * 40 * 4))
			top += rows
		}

		expect(meter.result()).toEqual(whole)
		expect(whole.sharpness).toBeGreaterThan(0)
	})

	// spec: SERIES-006.3
	it('refuses a band out of order, more rows than the photo has, a band of the wrong size and a result too early', () => {
		const rgba = noise(10, 10)
		const meter = sharpnessMeter(10, 10)
		expect(() => meter.addBand(5, 5, rgba.subarray(200))).toThrow(RangeError)
		meter.addBand(0, 6, rgba.subarray(0, 240))
		expect(() => meter.result()).toThrow(RangeError)
		expect(() => meter.addBand(6, 3, rgba.subarray(0, 40))).toThrow(RangeError)
		expect(() => meter.addBand(6, 5, new Uint8ClampedArray(200))).toThrow(RangeError)
		meter.addBand(6, 4, rgba.subarray(240))
		expect(meter.result()).toEqual(measureSharpness(rgba, 10, 10))
	})
})

describe('sharpestOf', () => {
	// spec: SERIES-006.5
	it('names the best when it is at least 5 % above the second best', () => {
		expect(sharpestOf([100, 105, 30])).toBe(1)
		expect(sharpestOf([0, 3])).toBe(1)
	})

	// spec: SERIES-006.5
	it('names none when two are closer, a value is missing or the series is too small', () => {
		expect(sharpestOf([100, 104.9])).toBeNull()
		expect(sharpestOf([0, 0])).toBeNull()
		expect(sharpestOf([100, null, 300])).toBeNull()
		expect(sharpestOf([100])).toBeNull()
		expect(sharpestOf([])).toBeNull()
	})
})
