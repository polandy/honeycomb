// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// The lines the calibration script prints for one series (docs/dev/calibration.md).
import type { Sharpness } from '../../src/logic/sharpness.ts'

import { sharpestOf } from '../../src/logic/sharpness.ts'

/** A photo of a series as measured, or why it was not. */
export type MeasuredPhoto = { name: string } & (Sharpness | { error: string })

/** The digits a value is printed with. */
const DIGITS = 1

/** The heading, the measured photos sharpest first with their focus tile, then the photos not measured (SERIES-006.21). */
export function seriesReport(series: string, photos: readonly MeasuredPhoto[]): string[] {
	const sharpest = sharpestOf(photos.map((photo) => ('sharpness' in photo ? photo.sharpness : null)))
	const measured = photos.flatMap((photo) => ('sharpness' in photo ? [photo] : [])).sort((a, b) => b.sharpness - a.sharpness)
	const failed = photos.flatMap((photo) => ('error' in photo ? [photo] : []))
	return [
		`${series}: ${photos.length} photos, sharpest ${sharpest === null ? 'none' : photos[sharpest]!.name}`,
		...measured.map((photo, rank) => `  ${rank + 1}. ${photo.name}  ${photo.sharpness.toFixed(DIGITS)}  tile ${photo.focusTile}`),
		...failed.map((photo) => `  -  ${photo.name}  not measured: ${photo.error}`),
	]
}
