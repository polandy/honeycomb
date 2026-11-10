// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { clampTileSize, DEFAULT_TILE_SIZE, MAX_TILE_SIZE, MIN_TILE_SIZE, parseTileSize, pinchTileSize, wheelTileSize } from '../../../src/logic/tile-size.ts'

describe('tile size', () => {
	// spec: GRID-001.7
	it('ranges from 90 to 340 px and starts at 160 px, as in the mockup', () => {
		expect([MIN_TILE_SIZE, DEFAULT_TILE_SIZE, MAX_TILE_SIZE]).toEqual([90, 160, 340])
	})

	it.each([[50, 90], [90, 90], [200, 200], [340, 340], [1000, 340]])('clamps %d to %d', (size, clamped) => {
		expect(clampTileSize(size)).toBe(clamped)
	})
})

describe('wheelTileSize', () => {
	it.each([
		['grows when scrolled up', -10, 160 * Math.exp(0.1)],
		['shrinks when scrolled down', 10, 160 * Math.exp(-0.1)],
		['stays without a delta', 0, 160],
		['stops at the largest size', -1000, 340],
		['stops at the smallest size', 1000, 90],
	])('%s', (_case, deltaY, size) => {
		expect(wheelTileSize(160, deltaY)).toBeCloseTo(size)
	})
})

describe('pinchTileSize', () => {
	it.each([
		['grows with the fingers apart', 200, 300, 240],
		['shrinks with the fingers together', 200, 100, 90],
		['stays at the start distance', 200, 200, 160],
		['stops at the largest size', 100, 1000, 340],
		['keeps the start size from a zero start distance', 0, 100, 160],
	])('%s', (_case, startDistance, distance, size) => {
		expect(pinchTileSize(160, startDistance, distance)).toBeCloseTo(size)
	})
})

describe('parseTileSize', () => {
	it.each([
		['a stored size', '200', 200],
		['a fractional size', '172.5', 172.5],
		['nothing stored', null, DEFAULT_TILE_SIZE],
		['an empty value', '', DEFAULT_TILE_SIZE],
		['garbage', 'large', DEFAULT_TILE_SIZE],
		['a unit', '200px', DEFAULT_TILE_SIZE],
		['infinity', 'Infinity', DEFAULT_TILE_SIZE],
		['too small a size', '10', MIN_TILE_SIZE],
		['too large a size', '9999', MAX_TILE_SIZE],
	])('reads %s', (_case, stored, size) => {
		expect(parseTileSize(stored)).toBe(size)
	})
})
