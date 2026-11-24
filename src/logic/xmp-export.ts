// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'
import type { XmpCacheRow } from './xmp-cache.ts'

import { isPair } from './sidecar-sync.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** What *Write picks/rejects to XMP* writes: the pictures, the sidecars to limit each to, and how many XMP files differ (XMP-003.39). */
export interface ExportPlan {
	readonly pictures: Picture<ListingEntry>[]
	/** A picture needing a created sidecar is not limited, so its new sidecars start from the others' values. */
	readonly paths: Map<Picture<ListingEntry>, Set<string>>
	readonly files: number
}

type Rows = ReadonlyMap<number, XmpCacheRow>
type Known = ReadonlyMap<string, { readonly fileId: PictureId }>

/** Whether the sidecar's row states another pick/reject or Keep RAW than the decision; an unflagged picture keeps a row stating nothing or PickLabel 2. */
export function differs(row: XmpCacheRow, decision: Decision, pair: boolean): boolean {
	const flagDiffers = decision.flag === 'unflagged' ? row.flag === 'picked' || row.flag === 'rejected' : row.flag !== decision.flag
	return flagDiffers || (pair && (row.keepRaw === true) !== decision.keepRaw)
}

/** The pictures whose sidecars differ from their flags and the number of XMP files that would be written; a sidecar is created only for a picture that is flagged or keeps its RAW (XMP-003.41). */
export function exportPlan(pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, rows: Rows, known: Known): ExportPlan {
	const plan: ExportPlan = { pictures: [], paths: new Map(), files: 0 }
	let files = 0
	for (const picture of pictures) {
		const decision = decisionOf(picture)
		const pair = isPair(picture)
		const { existing, created } = sidecarTargets(picture)
		const sidecars = [
			...existing.map(({ path, fileId }) => ({ path, fileId })),
			...created.flatMap((path) => known.get(path) === undefined ? [] : [{ path, fileId: known.get(path)!.fileId }]),
		]
		const differing = sidecars.filter(({ fileId }) => {
			const row = rows.get(fileId)
			return row?.state === 'read' && differs(row, decision, pair)
		}).map(({ path }) => path)
		const toCreate = created.filter((path) => !known.has(path))
		const creating = toCreate.length > 0 && (decision.flag !== 'unflagged' || (pair && decision.keepRaw))
		if (differing.length === 0 && !creating) {
			continue
		}
		plan.pictures.push(picture)
		if (!creating) {
			plan.paths.set(picture, new Set(differing))
		}
		files += differing.length + (creating ? toCreate.length : 0)
	}
	return { ...plan, files }
}
