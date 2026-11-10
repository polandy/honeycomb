// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderSet } from './folder-set.ts'
import type { ResumePosition } from './resume-position.ts'

import { folderSetKey } from './folder-set.ts'

/** How many positions the server keeps per user, `PositionService::RECENT_LIMIT`. */
export const RECENT_LIMIT = 20

/** One folder set under *Recent*: its stored position and its progress (DECISIONS-002.8). */
export interface RecentFolderSet {
	readonly position: ResumePosition
	/** Whether it is the folder set of the open cull. */
	readonly current: boolean
	readonly decided: number
	readonly total: number
}

/** The positions in their order, the open folder set marked and with the progress of its cull. */
export function recentFolderSets(positions: readonly ResumePosition[], current: FolderSet | null, progress: { decided: number, total: number }): RecentFolderSet[] {
	const key = current === null ? null : folderSetKey(current)
	return positions.map((position) => folderSetKey(position.folderSet) === key
		? { position, current: true, ...progress }
		: { position, current: false, decided: position.decided, total: position.total })
}

/** The positions with a saved one first, in place of the one of the same folder set, the most recent kept. */
export function withPosition(positions: readonly ResumePosition[], saved: ResumePosition): ResumePosition[] {
	const key = folderSetKey(saved.folderSet)
	return [saved, ...positions.filter((position) => folderSetKey(position.folderSet) !== key)].slice(0, RECENT_LIMIT)
}
