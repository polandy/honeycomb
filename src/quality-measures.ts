// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FetchedHashSeams } from './hash-drawing.ts'
import type { Sharpness } from './logic/sharpness.ts'

import { SHARPNESS_METHOD } from './logic/sharpness.ts'
import { measureFetched } from './sharpness-drawing.ts'

/** Where a measure's value is shown. */
export type MeasureSlot = 'loupe-info'

/** A translation of `text` of an app, as `t` of `@nextcloud/l10n` gives it. */
export type Translate = (app: string, text: string) => string

/** One kind of quality value (the value shape is still the sharpness's until a second measure needs another): how it is measured, stored and shown (SERIES-006.22). */
export interface QualityMeasure {
	readonly id: string
	/** The method number stored with its values; a value of another method counts as missing (ADR 0046). */
	readonly method: number
	/** Measures the photo at a URL in a worker. */
	readonly measure: (url: string, seams: FetchedHashSeams) => Promise<Sharpness>
	readonly label: (t: Translate) => string
	readonly slot: MeasureSlot
}

/** Every quality measure, the sharpness first. */
export const QUALITY_MEASURES: readonly QualityMeasure[] = [
	{ id: 'sharpness', method: SHARPNESS_METHOD, measure: measureFetched, label: (t) => t('honeycomb', 'Sharpness'), slot: 'loupe-info' },
]

/** The measure with `id`, or an error for an unknown one. */
export function measureById(id: string): QualityMeasure {
	const found = QUALITY_MEASURES.find((measure) => measure.id === id)
	if (found === undefined) {
		throw new Error(`Unknown quality measure ${id}`)
	}
	return found
}
