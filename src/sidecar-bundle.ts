// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarWrites } from './cull-seams.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Schedule } from './logic/long-press.ts'
import type { Picture } from './logic/pairing.ts'
import type { OnPageHide } from './page-hide.ts'

import { getCurrentScope, onScopeDispose, shallowRef } from 'vue'
import { pictureBundle } from './logic/picture-bundle.ts'

/** The cull's sidecar writes bundled per picture: written when the user leaves the picture, after the idle time or when the page hides (XMP-003.25–.29, ADR 0032). */
export function useBundledSidecars(sidecars: SidecarWrites, schedule: Schedule, onHide: OnPageHide) {
	const waiting = shallowRef<Picture<ListingEntry> | null>(null)
	const bundle = pictureBundle<Picture<ListingEntry>>(schedule, (picture) => (waiting.value = picture))
	const stop = onHide(() => void bundle.flush())
	if (getCurrentScope() !== undefined) {
		onScopeDispose(stop)
	}

	const write: SidecarWrites['write'] = (pictures, decisionOf, fields) => bundle.add(pictures, () => sidecars.write(pictures, decisionOf, fields))
	const writeTags: SidecarWrites['writeTags'] = (pictures, change) => bundle.add(pictures, () => sidecars.writeTags(pictures, change))

	return { read: sidecars.read, write, writeTags, waiting, leave: bundle.leave, flush: bundle.flush }
}
