// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { HashState } from './logic/hash-progress.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { StoredVisualHash } from './logic/visual-hash.ts'

import { computed, ref, shallowRef, triggerRef, watch } from 'vue'
import { removeStored } from './browser-storage.ts'
import { logger } from './logger.ts'
import { hashProgress } from './logic/hash-progress.ts'
import { imageMember, smallSource } from './logic/image-tiers.ts'
import { byFileId, saveQueue } from './logic/save-queue.ts'
import { hashablePictures } from './logic/series.ts'

/** The browser storage key under which earlier versions kept the visual hashes (ADR 0021); removed when a cull opens. */
export const VISUAL_HASHES_KEY = 'honeycomb.visualHashes'

/** How many computed hashes one save carries while hashing goes on (ADR 0024). */
const SAVE_BATCH = 100

/** Computes the visual hash of a member's image. */
export type HashImage = (member: ListingEntry) => Promise<string>

/** Stores computed visual hashes on the server. */
export type SaveVisualHashes = (hashes: readonly StoredVisualHash[]) => Promise<unknown>

/** A file version: a new etag means new pixels. */
const versionKey = (member: ListingEntry) => `${member.fileId}:${member.etag}`

/** What the cull's visual hashes need: the hasher, the save and a wait of seconds for a limited save (ADR 0026). */
export interface VisualHashApi {
	readonly hashImage: HashImage
	readonly saveVisualHashes: SaveVisualHashes
	readonly wait: (seconds: number) => Promise<void>
}

/** A hasher that hands the small grid preview's URL, already in the browser's cache, to the hash workers (SERIES-003.26). */
export function hashInWorkers(workers: { readonly hash: (url: string) => Promise<string> }, urlFor: ImageUrlFor) {
	return (member: Pick<ListingEntry, 'fileId' | 'mtime'>) => workers.hash(smallSource(member, urlFor))
}

/**
 * The visual hashes of the shown pictures: those the listing delivered, and the missing ones computed in the background one at
 * a time in tile order and saved to the server (SERIES-001.17, SERIES-003.12); a failed file version is not hashed again in this visit.
 */
export function useVisualHashes(api: VisualHashApi, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[]) {
	removeStored(storage, VISUAL_HASHES_KEY)
	const hashed = shallowRef(new Map<string, string>())
	const failed = shallowRef(new Set<string>())
	const saveFailed = ref(false)
	const published = shallowRef<ReadonlyMap<string, string>>(new Map())
	const hashable = computed(() => hashablePictures(pictures()).map(imageMember))
	const hashableKeys = computed(() => new Set(hashable.value.map(versionKey)))
	let pending: ListingEntry[] = []
	const unsaved: StoredVisualHash[] = []
	let running = false
	const queue = saveQueue<StoredVisualHash, number>(async (hashes) => {
		await api.saveVisualHashes(hashes)
	}, { key: byFileId, wait: api.wait })
	let held = false

	/** Makes the computed hashes count for the series. */
	function publish() {
		published.value = new Map(hashed.value)
	}

	/**
	 * Saves the computed hashes one save at a time, full batches while hashing goes on and the rest once it stops; a limited save
	 * waits and is sent again (SERIES-003.27), a failed one is logged and its hashes still count for this visit (SERIES-003.13).
	 */
	function save() {
		while (unsaved.length >= SAVE_BATCH || (!running && unsaved.length > 0)) {
			const batch = unsaved.splice(0, SAVE_BATCH)
			void queue(batch).then((result) => {
				saveFailed.value = !result.ok
				if (!result.ok) {
					logger.warn('Could not save the visual hashes', { error: result.error, count: batch.length })
				}
			})
		}
	}

	/** Hashes one member; a failure is logged and the file version is not hashed again. */
	async function hashOne(member: ListingEntry) {
		try {
			const hash = await api.hashImage(member)
			hashed.value.set(versionKey(member), hash)
			triggerRef(hashed)
			unsaved.push({ fileId: member.fileId, etag: member.etag, hash })
			if (!held) {
				publish()
			}
		} catch (error) {
			failed.value.add(versionKey(member))
			triggerRef(failed)
			logger.warn('Could not hash the preview', { error, fileId: member.fileId })
		}
	}

	/** Hashes the pending members in turn, so the tile loads keep their priority (SERIES-003.26), saving as it goes. */
	async function drain() {
		running = true
		for (let member = pending.shift(); member !== undefined; member = pending.shift()) {
			await hashOne(member)
			save()
		}
		running = false
		save()
	}

	/** The hash state of a member, or null when it is not hashable (SERIES-003.16). */
	function stateOf(member: ListingEntry): HashState | null {
		const key = versionKey(member)
		if (!hashableKeys.value.has(key)) {
			return null
		}
		if (member.visualHash !== null || hashed.value.has(key)) {
			return 'hashed'
		}
		return failed.value.has(key) ? 'failed' : 'pending'
	}

	watch(hashable, (members) => {
		pending = members.filter((member) => stateOf(member) === 'pending')
		if (!running && pending.length > 0) {
			void drain()
		}
	}, { immediate: true })

	return {
		/** The hash state of the picture's shown member, or null when it is not hashable. */
		stateOf: (picture: Picture<ListingEntry>) => stateOf(imageMember(picture)),
		/** How far the hashes of the hashable pictures are (SERIES-003.18–.20). */
		progress: computed(() => hashProgress(hashable.value.map((member) => stateOf(member)!), saveFailed.value)),
		/** The visual hash of the picture's shown member, or null while it has none. */
		hashOf(picture: Picture<ListingEntry>) {
			const member = imageMember(picture)
			return member.visualHash ?? published.value.get(versionKey(member)) ?? null
		},
		/** Holds new hashes back from the series, as while the series compare is open, and shows them on release. */
		hold(hold: boolean) {
			held = hold
			if (!hold) {
				publish()
			}
		},
	}
}
