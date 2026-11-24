// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ShallowRef } from 'vue'
import type { useCullFlags } from './cull-flags.ts'
import type { SidecarWrites } from './cull-seams.ts'
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { PictureId } from './logic/picture-id.ts'
import type { XmpCacheRow } from './logic/xmp-cache.ts'

import { logger } from './logger.ts'
import { withRows } from './logic/decision-change.ts'
import { FLAG_FIELDS, pictureDecision, UNDECIDED } from './logic/decision.ts'
import { flagSync } from './logic/flag-sync.ts'
import { memberIds } from './logic/pairing.ts'

/** What a visit's sync reads of the open cull. */
export interface CullFlagSyncState {
	readonly decisions: ShallowRef<ReadonlyMap<PictureId, Decision>>
	readonly writesThrough: (picture: Picture<ListingEntry>) => boolean
}

/** Syncs the flags of the read pictures with their sidecars: takes over a flag changed in digiKam, records the ETags that agree and writes the rest (ADR 0056). */
export function syncFlags(read: readonly Picture<ListingEntry>[], fromSidecars: { decided: { picture: Picture<ListingEntry>, decision: Decision }[], rows: ReadonlyMap<number, XmpCacheRow> }, flags: ReturnType<typeof useCullFlags>, sidecars: SidecarWrites, state: CullFlagSyncState) {
	const stated = new Map(fromSidecars.decided.map(({ picture, decision }) => [picture, decision]))
	// The listing is fresh on a visit, so it names every sidecar honeycomb created.
	const sync = flagSync(read.filter(state.writesThrough), { rows: fromSidecars.rows, stated: (picture) => stated.get(picture) ?? UNDECIDED, knownEtags: flags.knownEtags(), known: new Map() })
	const rows = sync.takenOver.flatMap(({ picture, flag }) => memberIds(picture).map((fileId) => ({ fileId, ...pictureDecision(picture, state.decisions.value), ...flag })))
	if (rows.length > 0) {
		state.decisions.value = withRows(state.decisions.value, rows)
		void flags.save(rows)
	}
	flags.record(sync.etags)
	if (sync.plan.pictures.length > 0) {
		sidecars.write(sync.plan.pictures, (picture) => pictureDecision(picture, state.decisions.value), FLAG_FIELDS, sync.plan.paths)
			.catch((error: unknown) => logger.error('Could not write the flags to the sidecars; the next visit writes them again', { error }))
	}
}
