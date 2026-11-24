// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../logic/decision.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { SidecarFlow } from './sidecar-flow.ts'

import { computed } from 'vue'
import { FLAG_FIELDS } from '../logic/decision.ts'
import { exportPlan } from '../logic/xmp-export.ts'
import { xmpExportText } from './sidecar-text.ts'

/** What *Write picks/rejects to XMP* works on: the rateable pictures of the folders, their decisions, and the writes to wait for. */
export interface XmpExportSeams {
	readonly pictures: () => readonly Picture<ListingEntry>[]
	readonly decisionOf: (picture: Picture<ListingEntry>) => Decision
	readonly flush: () => Promise<void>
}

/** Writing the picks, rejects and Keep RAW of every picture to its XMP files, with the count of files that differ (XMP-003.39 to .42). */
export function useXmpExport(flow: SidecarFlow, { pictures, decisionOf, flush }: XmpExportSeams) {
	const plan = () => exportPlan(pictures(), decisionOf, flow.sync.rows.value, flow.sync.known.value)
	const count = computed(() => plan().files)

	/** Writes what differs after the waiting writes, and says how many files it wrote and which it could not. */
	async function run() {
		await flush()
		const { pictures: planned, paths, files } = plan()
		const { failed } = await flow.sync.write(planned, decisionOf, FLAG_FIELDS, paths)
		const message = xmpExportText(files - failed.length, failed.map(({ reason }) => reason))
		if (failed.length > 0) {
			flow.toastFailed(message, failed)
			return
		}
		flow.toast(message)
	}

	return { count, run }
}
