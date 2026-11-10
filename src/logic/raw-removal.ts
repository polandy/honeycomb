// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { PictureFile } from './delete-summary.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { filesOf } from './delete-summary.ts'
import { parseFileName } from './file-name.ts'
import { isOwnSidecar } from './sidecars.ts'

/** What *Remove RAWs* does to a view: the pairs that lose their RAW, the marked pairs, and how many it skips. */
export interface RawRemoval {
	readonly removed: readonly Picture<ListingEntry>[]
	readonly kept: readonly Picture<ListingEntry>[]
	readonly rejected: number
	readonly singles: number
}

/** The RAW member and its own sidecars; the JPEG's and a shared sidecar stay (`docs/plan.md` Keep RAW and Remove RAWs). */
export function rawFilesOf(picture: Picture<ListingEntry>): PictureFile[] {
	if (picture.raw === null) {
		return []
	}
	const rawName = parseFileName(picture.raw.path).name
	return filesOf(picture).filter((file) => file.role === 'raw' || (file.role === 'sidecar' && isOwnSidecar(parseFileName(file.entry.path), rawName)))
}

/** Sorts the view's pictures: unmarked, unrejected pairs lose their RAW; marked pairs, rejected pairs and singles are skipped. */
export function rawRemoval(pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision): RawRemoval {
	const pairs = pictures.filter((picture) => picture.raw !== null && picture.rendered !== null)
	const kept = pairs.filter((picture) => decisionOf(picture).keepRaw)
	const unmarked = pairs.filter((picture) => !decisionOf(picture).keepRaw)
	const removed = unmarked.filter((picture) => decisionOf(picture).flag !== 'rejected')
	return { removed, kept, rejected: unmarked.length - removed.length, singles: pictures.length - pairs.length }
}

/** Each picture's RAW with its own sidecars as one unit, so a RAW that fails keeps its sidecar (ADR 0013). */
export function rawBatch(pictures: readonly Picture<ListingEntry>[]): PictureFile[][] {
	return pictures.map(rawFilesOf)
}
