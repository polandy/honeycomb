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
import { hashablePictures } from './logic/series.ts'
import { differenceHash, HASH_COLUMNS, HASH_ROWS } from './logic/visual-hash.ts'

/** The browser storage key under which earlier versions kept the visual hashes (ADR 0021); removed when a cull opens. */
export const VISUAL_HASHES_KEY = 'honeycomb.visualHashes'

/** How many computed hashes one save carries while hashing goes on (ADR 0024). */
const SAVE_BATCH = 100

/** Computes the visual hash of a member's image. */
export type HashImage = (member: ListingEntry) => Promise<string>

/** Stores computed visual hashes on the server. */
export type SaveVisualHashes = (hashes: readonly StoredVisualHash[]) => Promise<void>

/** A file version: a new etag means new pixels. */
const versionKey = (member: ListingEntry) => `${member.fileId}:${member.etag}`

/** A hasher that draws the member's small grid preview, already in the browser's cache, at the hash size. */
export function hashPreview(urlFor: ImageUrlFor): HashImage {
	return async (member) => {
		const image = new Image()
		image.src = smallSource(member, urlFor)
		await image.decode()
		const canvas = document.createElement('canvas')
		canvas.width = HASH_COLUMNS
		canvas.height = HASH_ROWS
		const context = canvas.getContext('2d', { willReadFrequently: true })
		if (context === null) {
			throw new Error('No 2D canvas to hash the preview')
		}
		context.imageSmoothingQuality = 'high'
		context.drawImage(image, 0, 0, HASH_COLUMNS, HASH_ROWS)
		return differenceHash(context.getImageData(0, 0, HASH_COLUMNS, HASH_ROWS).data)
	}
}

/**
 * The visual hashes of the shown pictures: those the listing delivered, and the missing ones computed in the background one at
 * a time and saved to the server (SERIES-001.17, SERIES-003.12); a failed file version is not hashed again in this visit.
 */
export function useVisualHashes(api: { readonly hashImage: HashImage, readonly saveVisualHashes: SaveVisualHashes }, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[]) {
	removeStored(storage, VISUAL_HASHES_KEY)
	const hashed = shallowRef(new Map<string, string>())
	const failed = shallowRef(new Set<string>())
	const saveFailed = ref(false)
	const published = shallowRef<ReadonlyMap<string, string>>(new Map())
	const hashable = computed(() => hashablePictures(pictures()).map(imageMember))
	const hashableKeys = computed(() => new Set(hashable.value.map(versionKey)))
	let pending: ListingEntry[] = []
	let unsaved: StoredVisualHash[] = []
	let running = false
	let held = false

	/** Makes the computed hashes count for the series. */
	function publish() {
		published.value = new Map(hashed.value)
	}

	/** Saves the hashes computed since the last save; a failure is logged and the hashes still count for this visit (SERIES-003.13). */
	async function save() {
		const batch = unsaved
		unsaved = []
		if (batch.length === 0) {
			return
		}
		try {
			await api.saveVisualHashes(batch)
			saveFailed.value = false
		} catch (error) {
			saveFailed.value = true
			logger.warn('Could not save the visual hashes', { error, count: batch.length })
		}
	}

	/** Hashes the pending members in turn, saving every batch and what is left once none is pending. */
	async function drain() {
		running = true
		while (pending.length > 0) {
			for (let member = pending.shift(); member !== undefined; member = pending.shift()) {
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
				if (unsaved.length >= SAVE_BATCH) {
					await save()
				}
			}
			await save()
		}
		running = false
	}

	/** The hash state of a member, or null when it is not hashable (SERIES-003.16). */
	function stateOf(member: ListingEntry): HashState | null {
		const key = versionKey(member)
		if (member.visualHash !== null || hashed.value.has(key)) {
			return 'hashed'
		}
		if (!hashableKeys.value.has(key)) {
			return null
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
		/** The visual hash of the picture's shown member, or null while it has none. */
		/** The hash state of the picture's shown member, or null when it is not hashable. */
		stateOf: (picture: Picture<ListingEntry>) => stateOf(imageMember(picture)),
		/** How far the hashes of the hashable pictures are (SERIES-003.18–.20). */
		progress: computed(() => hashProgress(hashable.value.map((member) => stateOf(member)!), saveFailed.value)),
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
