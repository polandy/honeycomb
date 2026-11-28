// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { QualityValue, Sharpness, StoredQualityValue } from '../logic/sharpness.ts'

import { LOUPE_TIER, tierSource } from '../logic/image-tiers.ts'
import { useBackgroundValues } from '../shared/background-values.ts'
import { measureById } from './quality-measures.ts'

/** Measures the sharpness of a member's photo. */
export type MeasureImage = (member: ListingEntry) => Promise<Sharpness>

/** Stores measured quality values on the server. */
export type SaveQualityValues = (values: readonly StoredQualityValue[]) => Promise<unknown>

/** What the cull's quality values need: the measurer, the save and a wait of seconds for a limited save (ADR 0026). */
export interface QualityApi {
	readonly measureImage: MeasureImage
	readonly saveQualityValues: SaveQualityValues
	readonly wait: (seconds: number) => Promise<void>
}

/** The measure the cull takes (SERIES-006.22). */
const SHARPNESS = measureById('sharpness')

/** The listed value of a member when it was measured by the current method, else null (ADR 0046). */
function currentValue(member: ListingEntry): QualityValue | null {
	return member.quality?.method === SHARPNESS.method ? member.quality : null
}

/** A measurer that hands the member's loupe tier URL to the hash pool's workers (SERIES-006.19). */
export function measureInWorkers(workers: { readonly measure: (measureId: string, url: string) => Promise<Sharpness> }, urlFor: ImageUrlFor) {
	return (member: Pick<ListingEntry, 'fileId' | 'mtime'>) => workers.measure(SHARPNESS.id, tierSource(member, LOUPE_TIER, urlFor))
}

/**
 * The quality values of `members`: those the listing delivered by the current method, and the missing ones measured in the
 * background once `ready`, one at a time in their order, and saved to the server (SERIES-006.15–.18).
 */
export function useQualityValues(api: QualityApi, members: () => readonly ListingEntry[], ready: () => boolean) {
	const measured = useBackgroundValues<Sharpness, StoredQualityValue>({
		compute: api.measureImage,
		save: api.saveQualityValues,
		wait: api.wait,
		row: (member, value) => ({ fileId: member.fileId, etag: member.etag, method: SHARPNESS.method, ...value }),
		listed: (member) => currentValue(member) !== null,
		failures: { compute: 'Could not measure the photo', save: 'Could not save the quality values' },
	}, members, ready)

	return {
		/** Where the member's value stands: listed or measured, failed in this visit, or still to measure. */
		stateOf: measured.stateOf,
		/** The quality value of the member's file version, or null while it has none. */
		qualityOf(member: ListingEntry): QualityValue | null {
			const value = measured.computedOf(member)
			return value === undefined ? currentValue(member) : { method: SHARPNESS.method, ...value }
		},
	}
}
