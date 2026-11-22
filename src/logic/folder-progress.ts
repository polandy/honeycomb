// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { FolderRow } from './folder-row.ts'

import { percent } from './folder-row.ts'

/** How far a set of folders has come (ADR 0049, P1). */
export interface FolderProgress {
	readonly folders: number
	readonly photos: number
	readonly doneFolders: number
	readonly donePhotos: number
	/** Photos in done folders as a share of all photos: the headline. */
	readonly donePercent: number
	/** Folders marked done in the clock's calendar month (UTC). */
	readonly doneThisMonth: number
	/** Picked and rejected photos as a share of all photos. */
	readonly decidedPercent: number
}

/** The progress of all rows below the roots and of each root. */
export interface LibraryProgress {
	readonly total: FolderProgress
	readonly perRoot: readonly { readonly root: string, readonly progress: FolderProgress }[]
}

/** The progress of the rows below `roots`, in total and per root; `now` sets the month. */
export function folderProgress(rows: readonly FolderRow[], roots: readonly string[], now: Date): LibraryProgress {
	const below = rows.filter((row) => roots.includes(row.root))
	return {
		total: progressOf(below, now),
		perRoot: roots.map((root) => ({ root, progress: progressOf(below.filter((row) => row.root === root), now) })),
	}
}

/**
 *
 */
function progressOf(rows: readonly FolderRow[], now: Date): FolderProgress {
	const done = rows.filter((row) => row.done !== null)
	const photos = sum(rows, (row) => row.photos)
	const donePhotos = sum(done, (row) => row.photos)
	const monthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth()) / 1000
	const nextMonthStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1) / 1000
	return {
		folders: rows.length,
		photos,
		doneFolders: done.length,
		donePhotos,
		donePercent: percent(donePhotos, photos),
		doneThisMonth: done.filter((row) => row.done!.at >= monthStart && row.done!.at < nextMonthStart).length,
		decidedPercent: percent(sum(rows, (row) => row.picked + row.rejected), photos),
	}
}

/**
 *
 */
function sum(rows: readonly FolderRow[], count: (row: FolderRow) => number): number {
	return rows.reduce((total, row) => total + count(row), 0)
}
