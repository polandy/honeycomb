// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The smallest target tile size in CSS pixels. */
export const MIN_TILE_SIZE = 90

/** The largest target tile size in CSS pixels. */
export const MAX_TILE_SIZE = 340

/** The target tile size before the user zooms the grid. */
export const DEFAULT_TILE_SIZE = 160

/** How strongly one pixel of wheel delta zooms, as the mockup's loupe and series zoom. */
const WHEEL_ZOOM_RATE = 0.01

/** The size within the smallest and the largest tile size. */
export function clampTileSize(size: number): number {
	return Math.min(MAX_TILE_SIZE, Math.max(MIN_TILE_SIZE, size))
}

/** The size after a wheel turn; a turn up grows the tiles. */
export function wheelTileSize(size: number, deltaY: number): number {
	return clampTileSize(size * Math.exp(-deltaY * WHEEL_ZOOM_RATE))
}

/** The size during a pinch that started at `startSize` with the fingers `startDistance` apart. */
export function pinchTileSize(startSize: number, startDistance: number, distance: number): number {
	return clampTileSize(startDistance > 0 ? startSize * distance / startDistance : startSize)
}

/** The stored size, clamped; the default size when nothing or no number is stored. */
export function parseTileSize(stored: string | null): number {
	const size = stored === null || stored.trim() === '' ? Number.NaN : Number(stored)
	return Number.isFinite(size) ? clampTileSize(size) : DEFAULT_TILE_SIZE
}
