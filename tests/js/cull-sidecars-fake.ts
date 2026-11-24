// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarWrites } from '../../src/cull/cull-seams.ts'
import type { Decision, StoredDecision } from '../../src/logic/decision.ts'
import type { FolderSet } from '../../src/logic/folder-set.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings } from '../../src/logic/settings.ts'
import type { SidecarFailure, SidecarFailureReason } from '../../src/logic/sidecar-sync.ts'
import type { StatsCounts } from '../../src/logic/stats-counts.ts'
import type { Tag, TagChange } from '../../src/logic/tag.ts'
import type { ListedAccess } from '../../src/logic/writability.ts'
import type { XmpCacheRow } from '../../src/logic/xmp-cache.ts'

import { shallowRef } from 'vue'
import { useCull } from '../../src/cull/cull.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { fakeFlags, fakeStorage, NO_SERIES, SAVED_SERIES } from './app-cull.ts'

/** A decision of three stars, rejected. */
export const THREE_REJECTED: Decision = { ...UNDECIDED, rating: 3, flag: 'rejected' }

/** The listing's access of `/Trip/A` and `/Trip/B`, every permission unless `permissions` names others. */
export function access(permissions: Record<string, number> = {}): ListedAccess {
	return { folders: ['/Trip/A', '/Trip/B'].map((path) => ({ path, permissions: permissions[path] ?? 31 })) }
}

/** A cull whose sidecars read as `takenOver` with the cache `rows`, fail as `failing` names, whose flag table holds `stored` with the `etags`, and whose writes are recorded; `open` lists the entries with the table's rows; flags are written to the sidecars only with `writeFlags`. */
export function cullWith(options: { stored?: StoredDecision[], etags?: Record<number, string>, takenOver?: Promise<Map<string, Decision>>, tagsTakenOver?: Map<string, Tag[]>, failing?: Record<string, SidecarFailureReason>, rows?: XmpCacheRow[], writeFlags?: boolean } = {}) {
	const reads: string[][] = []
	/** The paths each sidecar write was limited to, by picture name. */
	const writePaths: Record<string, string[]>[] = []
	const tagWrites: { names: string[], change: TagChange }[] = []
	const writes: { name: string, decision: Decision, fields: readonly string[] }[][] = []
	/** The counts each sidecar write carried, by picture name. */
	const counted: Record<string, StatsCounts>[] = []
	const countsOf = (pictures: readonly Picture<ListingEntry>[], counts?: (picture: Picture<ListingEntry>) => StatsCounts) => Object.fromEntries(pictures.map((picture) => [picture.baseName, counts?.(picture) ?? {}]))
	const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS, writeFlagsToXmp: options.writeFlags ?? false })
	const flags = fakeFlags(options.stored, options.etags)
	const notSaved: number[] = []
	const failures = (pictures: readonly Picture<ListingEntry>[]): SidecarFailure[] => pictures.flatMap((picture) => {
		const reason = options.failing?.[picture.baseName]
		return reason === undefined ? [] : [{ path: `${picture.folder}/${picture.baseName}.xmp`, picture, reason }]
	})
	const sidecars: SidecarWrites = {
		read: async (pictures) => {
			reads.push(pictures.map((picture) => picture.baseName))
			const decisions = await (options.takenOver ?? Promise.resolve(new Map<string, Decision>()))
			const tags = options.tagsTakenOver ?? new Map<string, Tag[]>()
			return {
				decided: pictures.filter((picture) => decisions.has(picture.baseName)).map((picture) => ({ picture, decision: decisions.get(picture.baseName)! })),
				tagged: pictures.filter((picture) => tags.has(picture.baseName)).map((picture) => ({ picture, tags: tags.get(picture.baseName)! })),
				rows: new Map((options.rows ?? []).map((row) => [row.fileId, row])),
			}
		},
		write: async (pictures, decisionOf, fields, paths, counts) => {
			counted.push(countsOf(pictures, counts))
			writePaths.push(Object.fromEntries([...(paths ?? new Map()).entries()].map(([picture, limited]) => [picture.baseName, [...limited]])))
			writes.push(pictures.map((picture) => ({ name: picture.baseName, decision: decisionOf(picture), fields })))
			return { written: pictures.length, failed: failures(pictures) }
		},
		writeTags: async (pictures, change, _paths, counts) => {
			counted.push(countsOf(pictures, counts))
			tagWrites.push({ names: pictures.map((picture) => picture.baseName), change })
			return { written: pictures.length, failed: [] }
		},
	}
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		measureImage: async () => ({ sharpness: 0, focusTile: 0 }),
		saveQualityValues: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		flags: flags.api,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: { loadTagList: async () => [] },
	}, fakeStorage(), () => settings.value, sidecars, (photos) => notSaved.push(photos))
	const picture = (name: string): Picture<ListingEntry> => cull.pictures.value.find((each) => each.baseName === name)!
	const open = (set: FolderSet, entries: readonly ListingEntry[], listed?: ListedAccess) => cull.open(set, flags.listed(entries), listed)
	return { cull, reads, writes, writePaths, settings, picture, tagWrites, flags, open, notSaved, counted }
}
