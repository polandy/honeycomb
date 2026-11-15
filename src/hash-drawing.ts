// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { differenceHash, HASH_COLUMNS, HASH_ROWS } from './logic/visual-hash.ts'

/** The part of a 2D canvas context that draws a preview at the hash size. */
type HashContext = Pick<CanvasRenderingContext2D, 'imageSmoothingQuality' | 'drawImage' | 'getImageData'>

/** What a worker needs to load a preview and draw it off screen. */
export interface FetchedHashSeams {
	readonly fetch: (url: string) => Promise<Response>
	readonly decode: (blob: Blob) => Promise<ImageBitmap>
	readonly canvas: (width: number, height: number) => OffscreenCanvas
}

/** Draws `image` at the hash size, smoothed, and hashes the pixels (SERIES-004.7). */
function drawHash(image: CanvasImageSource, context: HashContext | null): string {
	if (context === null) {
		throw new Error('No 2D canvas to hash the preview')
	}
	context.imageSmoothingQuality = 'high'
	context.drawImage(image, 0, 0, HASH_COLUMNS, HASH_ROWS)
	return differenceHash(context.getImageData(0, 0, HASH_COLUMNS, HASH_ROWS).data)
}

/** Fetches the preview at `url` and hashes it like the grid, without a DOM (SERIES-004.7). */
export async function hashFetched(url: string, seams: FetchedHashSeams): Promise<string> {
	const response = await seams.fetch(url)
	if (!response.ok) {
		throw new Error(`Preview answered ${response.status}`)
	}
	const bitmap = await seams.decode(await response.blob())
	return drawHash(bitmap, seams.canvas(HASH_COLUMNS, HASH_ROWS).getContext('2d', { willReadFrequently: true }))
}
