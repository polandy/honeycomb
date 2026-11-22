// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** A sidecar with no photo or video of its own in its folder, as the scan lists it (XMP-009). */
export interface OrphanedSidecar {
	readonly fileId: number
	readonly etag: string
	readonly path: string
	readonly size: number
}

/** One page of the scan; `nextCursor` is the cursor of the following page, `null` after the last. */
export interface OrphanedSidecarPage {
	readonly sidecars: OrphanedSidecar[]
	readonly nextCursor: string | null
}

/** What the trash endpoint answered for one sidecar (DELETE-001's results plus `notOrphaned`). */
export type OrphanedSidecarResult = 'trashed' | 'notFound' | 'changed' | 'notPermitted' | 'noTrashBin' | 'tooLarge' | 'locked' | 'failed' | 'notOrphaned'

/** The trash endpoint's answer for one sidecar. */
export interface OrphanedSidecarAnswer {
	readonly fileId: number
	readonly result: OrphanedSidecarResult
}

/** Why a sidecar stayed; `notSent` after a failed request. */
export type OrphanedSidecarSkip = Exclude<OrphanedSidecarResult, 'trashed'> | 'notSent'

/** One folder of the list with its orphans, how many and how large. */
export interface OrphanedFolder {
	readonly path: string
	readonly count: number
	readonly size: number
	readonly sidecars: readonly (OrphanedSidecar & { readonly name: string })[]
}

/** The orphans by folder, with the total count and size. */
export interface OrphanedSidecarList {
	readonly folders: readonly OrphanedFolder[]
	readonly count: number
	readonly size: number
}

/** What a move did: how many moved to the trash bin, and each skipped sidecar with its reason. */
export interface OrphanedSidecarReport {
	readonly trashed: number
	readonly skipped: readonly { readonly path: string, readonly reason: OrphanedSidecarSkip }[]
}

/** The sidecars grouped by their folder, the folders in the order found (XMP-009.11). */
export function groupByFolder(sidecars: readonly OrphanedSidecar[]): OrphanedSidecarList {
	const folders = new Map<string, OrphanedFolder>()
	for (const sidecar of sidecars) {
		const slash = sidecar.path.lastIndexOf('/')
		const path = slash > 0 ? sidecar.path.slice(0, slash) : '/'
		const folder = folders.get(path) ?? { path, count: 0, size: 0, sidecars: [] }
		folders.set(path, { path, count: folder.count + 1, size: folder.size + sidecar.size, sidecars: [...folder.sidecars, { ...sidecar, name: sidecar.path.slice(slash + 1) }] })
	}
	return { folders: [...folders.values()], count: sidecars.length, size: sidecars.reduce((sum, { size }) => sum + size, 0) }
}

/** The report of a move from the sidecars sent and the answers received; one without an answer was not sent (XMP-009.12). */
export function moveReport(sent: readonly OrphanedSidecar[], answers: readonly OrphanedSidecarAnswer[]): OrphanedSidecarReport {
	const results = new Map(answers.map(({ fileId, result }) => [fileId, result]))
	const skipped = sent.flatMap(({ fileId, path }): { path: string, reason: OrphanedSidecarSkip }[] => {
		const result = results.get(fileId) ?? 'notSent'
		return result === 'trashed' ? [] : [{ path, reason: result }]
	})
	return { trashed: sent.length - skipped.length, skipped }
}
