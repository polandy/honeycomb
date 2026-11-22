// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'

import { percent } from './folder-row.ts'
import { formatBytes, formatCount } from './folder-texts.ts'
import { SERIES_GAP_SECONDS } from './series.ts'

/** The longest gap between a burst photo and its predecessor: the series rule's, which the PHP summary counts too (ADR 0049). */
export const BURST_GAP_SECONDS = SERIES_GAP_SECONDS

/** How much a folder made only of bursts outweighs one without: 1 + this. */
const BURST_WEIGHT = 2

/** The bytes per photo from which a folder counts as RAW-heavy and the size factor stops growing. */
const HEAVY_BYTES_PER_PHOTO = 25 * 1024 * 1024

/** How much a RAW-heavy folder outweighs a light one: 1 + this. */
const SIZE_WEIGHT = 1

/** What a folder gains from being culled; 0 without photos. Compare scores, never show one (ADR 0049). */
export function folderScore(row: Pick<FolderRow, 'photos' | 'undecided' | 'bursts' | 'bytes'>): number {
	if (row.photos === 0) {
		return 0
	}
	const burstFactor = 1 + BURST_WEIGHT * row.bursts / row.photos
	const sizeFactor = 1 + SIZE_WEIGHT * Math.min(1, row.bytes / row.photos / HEAVY_BYTES_PER_PHOTO)
	return row.undecided * burstFactor * sizeFactor
}

/** Why the folder is worth culling, as the row shows it: "63 % undecided · 18 in bursts · 4.2 GB · 2019". */
export function folderReason(row: FolderRow): string {
	const parts = [`${percent(row.undecided, row.photos)} % undecided`]
	if (row.bursts > 0) {
		parts.push(`${formatCount(row.bursts)} in bursts`)
	}
	parts.push(formatBytes(row.bytes))
	if (row.oldest !== null) {
		parts.push(String(new Date(row.oldest * 1000).getUTCFullYear()))
	}
	return parts.join(' · ')
}
