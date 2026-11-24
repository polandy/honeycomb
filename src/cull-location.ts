// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullLocation } from './logic/cull-location.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { PictureId } from './logic/picture-id.ts'

import { watch } from 'vue'
import { fireAndLog } from './fire-and-log.ts'
import { locationHash, parseLocation } from './logic/cull-location.ts'

/** The page address, which keeps the open cull across a browser reload (DECISIONS-002.17). */
export interface LocationApi {
	read(): string
	write(hash: string): void
}

/** The browser's address, replaced in place so the back button is not filled. */
export const browserLocation: LocationApi = {
	read: () => window.location.hash,
	write: (hash) => window.history.replaceState(null, '', hash === '' ? window.location.pathname + window.location.search : hash),
}

/** What the address follows: the open folder set and the picture of the open loupe. */
export interface LocatedCull {
	readonly folderSet: () => FolderSet | null
	readonly shownFileId: () => PictureId | null
}

/** Opens the cull the address names, then keeps the address on the open cull. */
export function useCullLocation(api: LocationApi, cull: LocatedCull, restore: (location: CullLocation) => Promise<void>) {
	const follow = () => watch(() => locationHash(cull.folderSet(), cull.shownFileId()), (hash) => api.write(hash), { immediate: true })
	const named = parseLocation(api.read())
	if (named === null) {
		follow()
	} else {
		fireAndLog(restore(named).finally(follow), 'Could not open the cull the address names')
	}
}
