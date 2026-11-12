// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { ImageUrlFor } from './logic/image-tiers.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'

import { shallowRef, watch } from 'vue'
import { readStored, writeStored } from './browser-storage.ts'
import { logger } from './logger.ts'
import { imageMember, smallSource } from './logic/image-tiers.ts'
import { hashablePictures } from './logic/series.ts'
import { differenceHash, HASH_COLUMNS, HASH_ROWS, parseHashCache, serializeHashCache } from './logic/visual-hash.ts'

/** The browser storage key of the visual hashes (ADR 0021). */
export const VISUAL_HASHES_KEY = 'honeycomb.visualHashes'

/** The most visual hashes kept in the browser, about 60 characters each (ADR 0021). */
const CACHE_SIZE = 10000

/** Computes the visual hash of a member's image. */
export type HashImage = (member: ListingEntry) => Promise<string>

/** The cache key of a file version: a new etag means new pixels. */
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

/** The visual hashes of the shown pictures, computed in the background one at a time and kept per file version (SERIES-001.17). */
export function useVisualHashes(hashImage: HashImage, storage: BrowserStorage, pictures: () => readonly Picture<ListingEntry>[]) {
	const cache = parseHashCache(readStored(storage, VISUAL_HASHES_KEY))
	const published = shallowRef<ReadonlyMap<string, string>>(new Map(cache))
	let pending: ListingEntry[] = []
	let running = false
	let held = false

	/** Makes the cached hashes count for the series. */
	function publish() {
		published.value = new Map(cache)
	}

	/** Hashes the pending members in turn, then stores the cache. */
	async function drain() {
		running = true
		for (let member = pending.shift(); member !== undefined; member = pending.shift()) {
			try {
				cache.set(versionKey(member), await hashImage(member))
				if (!held) {
					publish()
				}
			} catch (error) {
				logger.warn('Could not hash the preview', { error, fileId: member.fileId })
			}
		}
		running = false
		writeStored(storage, VISUAL_HASHES_KEY, serializeHashCache(cache, CACHE_SIZE))
	}

	watch(pictures, (shown) => {
		pending = hashablePictures(shown).map(imageMember).filter((member) => !cache.has(versionKey(member)))
		if (!running && pending.length > 0) {
			void drain()
		}
	}, { immediate: true })

	return {
		/** The visual hash of the picture's shown member, or null while it has none. */
		hashOf: (picture: Picture<ListingEntry>) => published.value.get(versionKey(imageMember(picture))) ?? null,
		/** Holds new hashes back from the series, as while the series compare is open, and shows them on release. */
		hold(hold: boolean) {
			held = hold
			if (!hold) {
				publish()
			}
		},
	}
}
