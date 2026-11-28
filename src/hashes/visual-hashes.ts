import type { HashState } from '../logic/hash-progress.ts'
import type { ImageUrlFor } from '../logic/image-tiers.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'
import type { StoredVisualHash } from '../logic/visual-hash.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from '../shared/browser-storage.ts'

import { computed, shallowRef } from 'vue'
import { hashProgress } from '../logic/hash-progress.ts'
import { imageMember, smallSource } from '../logic/image-tiers.ts'
import { hashablePictures } from '../logic/series.ts'
import { VISUAL_HASH_METHOD } from '../logic/visual-hash.ts'
import { useBackgroundValues, versionKey } from '../shared/background-values.ts'
import { removeStored } from '../shared/browser-storage.ts'

/** The browser storage key under which earlier versions kept the visual hashes (ADR 0021); removed when a cull opens. */
export const VISUAL_HASHES_KEY = 'honeycomb.visualHashes'

/** The listed hash of a member when it was taken by the current method, else null (SERIES-003.30). */
export function currentHash(member: ListingEntry): string | null {
	return member.visualHash?.method === VISUAL_HASH_METHOD ? member.visualHash.hash : null
}

/** Computes the visual hash of a member's image. */
export type HashImage = (member: ListingEntry) => Promise<string>

/** Stores computed visual hashes on the server. */
export type SaveVisualHashes = (hashes: readonly StoredVisualHash[]) => Promise<unknown>

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
	const published = shallowRef<ReadonlyMap<string, string>>(new Map())
	const hashable = computed(() => hashablePictures(pictures()).map(imageMember))
	const hashableKeys = computed(() => new Set(hashable.value.map(versionKey)))
	let held = false
	const hashes = useBackgroundValues<string, StoredVisualHash>({
		compute: api.hashImage,
		save: api.saveVisualHashes,
		wait: api.wait,
		row: (member, hash) => ({ fileId: member.fileId, etag: member.etag, method: VISUAL_HASH_METHOD, hash }),
		listed: (member) => currentHash(member) !== null,
		failures: { compute: 'Could not hash the preview', save: 'Could not save the visual hashes' },
		computed: () => {
			if (!held) {
				publish()
			}
		},
	}, () => hashable.value)

	/** Makes the computed hashes count for the series. */
	function publish() {
		published.value = new Map(hashes.values.value)
	}

	/** The hash state of a member, or null when it is not hashable (SERIES-003.16). */
	function stateOf(member: ListingEntry): HashState | null {
		if (!hashableKeys.value.has(versionKey(member))) {
			return null
		}
		const state = hashes.stateOf(member)
		return state === 'done' ? 'hashed' : state
	}

	return {
		/** The hash state of the picture's shown member, or null when it is not hashable. */
		stateOf: (picture: Picture<ListingEntry>) => stateOf(imageMember(picture)),
		/** How far the hashes of the hashable pictures are (SERIES-003.18–.20). */
		progress: computed(() => hashProgress(hashable.value.map((member) => stateOf(member)!), hashes.saveFailed.value)),
		/** Whether a hashable picture still waits for its hash. */
		pending: computed(() => hashable.value.some((member) => stateOf(member) === 'pending')),
		/** The visual hash of the picture's shown member, or null while it has none. */
		hashOf(picture: Picture<ListingEntry>) {
			const member = imageMember(picture)
			return currentHash(member) ?? published.value.get(versionKey(member)) ?? null
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
