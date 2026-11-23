// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The Nextcloud permission bit for UPDATE; a folder without it is read-only (ADR 0040). */
export const PERMISSION_UPDATE = 2

/** Who marked a folder done, when (Unix seconds) and how many photos it held then (ADR 0049). */
export interface FolderDone {
	readonly by: string | null
	readonly at: number
	readonly photos: number
}

/** One folder as `GET /api/v1/library/folders` answers; times are Unix seconds, null when unknown. */
export interface FolderRow {
	readonly fileId: number
	readonly root: string
	readonly path: string
	readonly photos: number
	readonly bytes: number
	readonly rawBytes: number
	readonly picked: number
	readonly rejected: number
	readonly undecided: number
	readonly bursts: number
	readonly oldest: number | null
	readonly newest: number | null
	readonly lastActivity: number | null
	readonly permissions: number
	readonly done: FolderDone | null
}

/** Whether the user may mark the folder done and flag in it. */
export function isRateable(row: FolderRow): boolean {
	return (row.permissions & PERMISSION_UPDATE) !== 0
}

/** Whether the folder has photos and none is undecided. */
export function isComplete(row: FolderRow): boolean {
	return row.photos > 0 && row.undecided === 0
}

/** Photos that arrived in a done folder since *Mark done*; 0 for a folder that is not done. */
export function newCount(row: FolderRow): number {
	return row.done === null ? 0 : Math.max(0, row.photos - row.done.photos)
}

/** `part` of `whole` in whole percent; 0 when there is no whole. */
export function percent(part: number, whole: number): number {
	return whole > 0 ? Math.round(100 * part / whole) : 0
}

/** The folder's own name, the last segment of its path. */
export function folderName(row: FolderRow): string {
	return row.path.split('/').pop()!
}
