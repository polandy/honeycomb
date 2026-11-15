// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullSidecars } from '../../src/cull-seams.ts'
import type { Decision, StoredDecision } from '../../src/logic/decision.ts'
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { Settings, SidecarWrite } from '../../src/logic/settings.ts'
import type { StoredTags, Tag, TagChange } from '../../src/logic/tag.ts'
import type { FolderAccess, ListedAccess, WriteLock } from '../../src/logic/writability.ts'

import { shallowRef } from 'vue'
import { useCull } from '../../src/cull.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { fakeStorage, NO_SERIES } from './app-cull.ts'

/** A decision of three stars, rejected. */
export const THREE_REJECTED: Decision = { ...UNDECIDED, rating: 3, flag: 'rejected' }

/** The listing's access of `/Trip` opened as file id 7, with the given folders changed from plain and writable. */
export function access(changed: Record<string, Partial<FolderAccess>> = {}): ListedAccess {
	const folder = (path: string): FolderAccess => ({ path, shared: false, permissions: 31, versions: true, ...changed[path] })
	return { folders: ['/Trip/A', '/Trip/B'].map(folder), opened: [{ path: '/Trip', fileId: 7 }] }
}

/** A cull whose sidecar take-over answers `takenOver` and whose writes and saves are recorded. */
export function cullWith(options: { stored?: StoredDecision[], takenOver?: Promise<Map<string, Decision>>, saveFails?: boolean, storedTags?: StoredTags[], tagsTakenOver?: Map<string, Tag[]>, tagLookupFails?: boolean, sidecarWrite?: SidecarWrite } = {}) {
	const locks: WriteLock[] = []
	const saved: StoredDecision[][] = []
	const takeOvers: { names: string[], stored: number[], tagged: number[] | null }[] = []
	const tagWrites: { names: string[], change: TagChange }[] = []
	const savedTags: StoredTags[][] = []
	const tagLookups: number[][] = []
	const writes: { name: string, decision: Decision, fields: readonly string[] }[][] = []
	const settings = shallowRef<Settings>({ ...DEFAULT_SETTINGS, sidecarWrite: options.sidecarWrite ?? 'on' })
	const sidecars: CullSidecars = {
		takeOver: async (pictures, storedIds, taggedIds) => {
			takeOvers.push({ names: pictures.map((picture) => picture.baseName), stored: [...storedIds].sort((a, b) => a - b), tagged: taggedIds && [...taggedIds].sort((a, b) => a - b) })
			const decisions = await (options.takenOver ?? Promise.resolve(new Map<string, Decision>()))
			const tags = options.tagsTakenOver ?? new Map<string, Tag[]>()
			return {
				decided: pictures.filter((picture) => decisions.has(picture.baseName)).map((picture) => ({ picture, decision: decisions.get(picture.baseName)! })),
				tagged: pictures.filter((picture) => tags.has(picture.baseName)).map((picture) => ({ picture, tags: tags.get(picture.baseName)! })),
			}
		},
		write: async (pictures, decisionOf, fields) => {
			writes.push(pictures.map((picture) => ({ name: picture.baseName, decision: decisionOf(picture), fields })))
			return { written: pictures.length, failed: [] }
		},
		writeTags: async (pictures, change) => {
			tagWrites.push({ names: pictures.map((picture) => picture.baseName), change })
			return { written: pictures.length, failed: [] }
		},
	}
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		warmPreviews: async () => undefined,
		lookupDecisions: async () => options.stored ?? [],
		lookupSeries: NO_SERIES,
		saveDecisions: async (rows) => {
			saved.push([...rows])
			if (options.saveFails) {
				throw new Error('offline')
			}
		},
		tags: {
			lookupTags: async (fileIds) => {
				tagLookups.push([...fileIds])
				if (options.tagLookupFails) {
					throw new Error('down')
				}
				return (options.storedTags ?? []).filter((row) => fileIds.includes(row.fileId))
			},
			saveTags: async (rows) => { savedTags.push([...rows]) },
			loadTagList: async () => [],
		},
	}, fakeStorage(), () => settings.value, sidecars, (lock) => locks.push(lock))
	const picture = (name: string): Picture<ListingEntry> => cull.pictures.value.find((each) => each.baseName === name)!
	return { cull, saved, takeOvers, writes, settings, picture, tagWrites, savedTags, tagLookups, locks }
}
