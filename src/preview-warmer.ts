// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { BrowserStorage } from './browser-storage.ts'
import type { ListingEntry } from './logic/listing.ts'

import { readStored, writeStored } from './browser-storage.ts'
import { logger } from './logger.ts'
import { PICTURE_CAP } from './logic/picture-order.ts'
import { parseWarmCache, serializeWarmCache, warmKey } from './logic/warm-cache.ts'

/** The browser storage key of the warmed file versions (ADR 0010). */
export const WARMED_PREVIEWS_KEY = 'honeycomb.warmedPreviews'

/** The most warmed file versions kept in the browser, one cull's worth. */
const CACHE_SIZE = PICTURE_CAP

/** How a warm-up is stopped, and told which files the server rendered. */
export interface WarmOptions {
	readonly signal?: AbortSignal
	readonly onWarmed?: (fileIds: readonly number[]) => void
}

/** Renders the previews of the files on the server. */
export type WarmPreviews = (fileIds: readonly number[], options: WarmOptions) => Promise<void>

/** Warms the previews of an opened folder set, skips file versions warmed before and stops the previous warm-up (IMAGES-001.14, .15). */
export function usePreviewWarmer(warmPreviews: WarmPreviews, storage: BrowserStorage) {
	const warmed = parseWarmCache(readStored(storage, WARMED_PREVIEWS_KEY))
	let running: AbortController | null = null

	/** Keeps the warmed versions for the next visit. */
	const store = () => writeStored(storage, WARMED_PREVIEWS_KEY, serializeWarmCache(warmed, CACHE_SIZE))

	return {
		/** Stops the previous warm-up and warms the members not warmed at their mtime, in the given order. */
		warm(members: readonly ListingEntry[]) {
			running?.abort()
			const keys = new Map<number, string>()
			for (const member of members) {
				const key = warmKey(member)
				if (warmed.delete(key)) {
					warmed.add(key)
				} else {
					keys.set(member.fileId, key)
				}
			}
			if (keys.size === 0) {
				store()
				return
			}
			const controller = new AbortController()
			running = controller
			const onWarmed = (fileIds: readonly number[]) => fileIds.forEach((fileId) => {
				const key = keys.get(fileId)
				if (key !== undefined) {
					warmed.add(key)
				}
			})
			warmPreviews([...keys.keys()], { signal: controller.signal, onWarmed })
				.catch((error: unknown) => logger.error('Could not warm the previews', { error }))
				.finally(store)
		},
	}
}
