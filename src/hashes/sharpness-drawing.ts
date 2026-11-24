import type { Sharpness } from '../logic/sharpness.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FetchedHashSeams } from './hash-drawing.ts'

import { sharpnessMeter } from '../logic/sharpness.ts'

/** The rows drawn at once, so a 4096 px photo holds about 4 MB of pixels, not 64 MB (ADR 0046). */
export const BAND_ROWS = 256

/** Fetches the photo at `url`, draws it at full size band by band and measures its sharpness, without a DOM (SERIES-006.19). */
export async function measureFetched(url: string, seams: FetchedHashSeams): Promise<Sharpness> {
	const response = await seams.fetch(url)
	if (!response.ok) {
		throw new Error(`Preview answered ${response.status}`)
	}
	const bitmap = await seams.decode(await response.blob())
	try {
		const { width, height } = bitmap
		const context = seams.canvas(width, BAND_ROWS).getContext('2d', { willReadFrequently: true })
		if (context === null) {
			throw new Error('No 2D canvas to measure the photo')
		}
		const meter = sharpnessMeter(width, height)
		for (let top = 0; top < height; top += BAND_ROWS) {
			const rows = Math.min(BAND_ROWS, height - top)
			context.drawImage(bitmap, 0, top, width, rows, 0, 0, width, rows)
			meter.addBand(top, rows, context.getImageData(0, 0, width, rows).data)
		}
		return meter.result()
	} finally {
		bitmap.close()
	}
}
