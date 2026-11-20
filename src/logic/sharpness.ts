// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The method of the measure below; a stored value of another method counts as missing (ADR 0046). */
export const SHARPNESS_METHOD = 1

/** The tiles per side of the grid the variance is taken in. */
const GRID = 8

/** How many of the GRID × GRID tiles count: the best 10 %, rounded up (ADR 0046). */
const BEST_TILES = Math.ceil((GRID * GRID) / 10)

/** The smallest side a Laplacian can be taken on. */
const MIN_SIDE = 3

/** Bytes per RGBA pixel. */
const RGBA = 4

/** Fractions of red, green and blue in the grey value (ITU-R BT.601). */
const RED = 0.299
const GREEN = 0.587
const BLUE = 0.114

/** How many percent of the second best the sharpest must measure at least (SERIES-006.5); whole numbers keep it exact. */
const SHARPEST_PERCENT = 105

/** The whole a percentage is of. */
const PERCENT = 100

/** A photo's measured sharpness and the 0–63 index of its best tile, row by row. */
export interface Sharpness {
	readonly sharpness: number
	readonly focusTile: number
}

/** A sharpness with the method it was measured by, as the listing gives it. */
export interface QualityValue extends Sharpness {
	readonly method: number
}

/** A quality value with the file version it was measured on, as it is saved. */
export interface StoredQualityValue extends QualityValue {
	readonly fileId: number
	readonly etag: string
}

/** The grey values of one RGBA row. */
function greyRow(rgba: Uint8ClampedArray, offset: number, width: number): Float64Array {
	const grey = new Float64Array(width)
	for (let x = 0; x < width; x++) {
		const pixel = offset + x * RGBA
		grey[x] = RED * rgba[pixel]! + GREEN * rgba[pixel + 1]! + BLUE * rgba[pixel + 2]!
	}
	return grey
}

/**
 * A measure of a `width` × `height` photo that takes its RGBA rows in bands, top to bottom, holding only two grey rows:
 * the variance of the 3×3 Laplacian per tile, the mean of the best tiles (SERIES-006.1–.3).
 */
export function sharpnessMeter(width: number, height: number) {
	if (width < MIN_SIDE || height < MIN_SIDE) {
		throw new RangeError(`A photo of ${width} × ${height} pixels is too small to measure`)
	}
	const count = new Float64Array(GRID * GRID)
	const sum = new Float64Array(GRID * GRID)
	const squares = new Float64Array(GRID * GRID)
	const columnOf = Array.from({ length: width }, (_, x) => Math.floor((x * GRID) / width))
	let above: Float64Array | null = null
	let middle: Float64Array | null = null
	let seen = 0

	/** Adds the Laplacian of the middle row, whose neighbours above and below are known. */
	function addRow(below: Float64Array) {
		const row = Math.floor(((seen - 1) * GRID) / height) * GRID
		for (let x = 1; x < width - 1; x++) {
			const laplacian = above![x]! + below[x]! + middle![x - 1]! + middle![x + 1]! - 4 * middle![x]!
			const tile = row + columnOf[x]!
			count[tile]!++
			sum[tile]! += laplacian
			squares[tile]! += laplacian * laplacian
		}
	}

	return {
		/** Adds `rows` rows of RGBA pixels starting at row `top`, the next rows of the photo. */
		addBand(top: number, rows: number, rgba: Uint8ClampedArray) {
			if (top !== seen || rows < 1 || top + rows > height || rgba.length !== rows * width * RGBA) {
				throw new RangeError(`A band of ${rows} rows at row ${top} does not follow row ${seen} of ${height}, or has ${rgba.length} bytes`)
			}
			for (let index = 0; index < rows; index++) {
				const grey = greyRow(rgba, index * width * RGBA, width)
				if (above !== null && middle !== null) {
					addRow(grey)
				}
				above = middle
				middle = grey
				seen++
			}
		},
		/** The sharpness once every row arrived. */
		result(): Sharpness {
			if (seen !== height) {
				throw new RangeError(`Only ${seen} of ${height} rows arrived`)
			}
			const variances = Array.from(count, (n, tile) => (n === 0 ? 0 : Math.max(0, squares[tile]! / n - (sum[tile]! / n) ** 2)))
			const best = [...variances].sort((a, b) => b - a).slice(0, BEST_TILES)
			return { sharpness: best.reduce((total, variance) => total + variance, 0) / BEST_TILES, focusTile: variances.indexOf(best[0]!) }
		},
	}
}

/** The sharpness of a whole RGBA photo of `width` × `height` pixels (SERIES-006.1). */
export function measureSharpness(rgba: Uint8ClampedArray, width: number, height: number): Sharpness {
	const meter = sharpnessMeter(width, height)
	meter.addBand(0, height, rgba)
	return meter.result()
}

/** The index of the sharpest value, at least 5 % above the second; null when closer, a value is missing or fewer than two (SERIES-006.5). */
export function sharpestOf(values: readonly (number | null)[]): number | null {
	if (values.length < 2 || values.includes(null)) {
		return null
	}
	const measured = values as readonly number[]
	const order = measured.map((_, index) => index).sort((a, b) => measured[b]! - measured[a]!)
	const [best, second] = [measured[order[0]!]!, measured[order[1]!]!]
	return best > second && best * PERCENT >= second * SHARPEST_PERCENT ? order[0]! : null
}

/** A member's rank by sharpness within its series, 1 for the sharpest value, and whether it is the sharpest (SERIES-007.6). */
export interface SharpnessPlace {
	readonly rank: number
	readonly count: number
	readonly sharpest: boolean
}

/** The sharpest of `members` by SERIES-006.5, or null. */
export function sharpestMember<P>(members: readonly P[], sharpnessOf: (member: P) => number | null): P | null {
	const index = sharpestOf(members.map(sharpnessOf))
	return index === null ? null : members[index]!
}

/** The place of `member` among `members`; null for a non-member, fewer than two members or a member without a value (SERIES-007.6). */
export function sharpnessPlace<P>(members: readonly P[], member: P, sharpnessOf: (member: P) => number | null): SharpnessPlace | null {
	const values = members.map(sharpnessOf)
	const own = members.indexOf(member)
	if (own < 0 || members.length < 2 || values.includes(null)) {
		return null
	}
	const value = values[own]!
	return { rank: 1 + values.filter((other) => other! > value).length, count: members.length, sharpest: sharpestOf(values) === own }
}

/** The fraction of a tile's middle along each side. */
const TILE_MIDDLE = 0.5

/** The middle of the focus tile as fractions of the photo's width and height. */
export function focusTileCentre(tile: number): { x: number, y: number } {
	return { x: ((tile % GRID) + TILE_MIDDLE) / GRID, y: (Math.floor(tile / GRID) + TILE_MIDDLE) / GRID }
}
