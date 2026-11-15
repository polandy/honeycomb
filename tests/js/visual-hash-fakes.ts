// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { StoredVisualHash } from '../../src/logic/visual-hash.ts'

import { shallowRef } from 'vue'
import { useVisualHashes } from '../../src/visual-hashes.ts'
import { fakeStorage } from './app-cull.ts'
import { listingEntry, picturesOf } from './logic/listing-entries.ts'

/** A burst: pair A, RAW-only B 10 s later, and C far apart. */
export const BURST = [
	listingEntry(1, '/P/A.JPG', { captureTime: 0 }),
	listingEntry(2, '/P/A.CR3', { captureTime: 0, mime: 'image/x-dcraw' }),
	listingEntry(3, '/P/B.CR3', { captureTime: 10, mime: 'image/x-dcraw' }),
	listingEntry(4, '/P/C.JPG', { captureTime: 500 }),
]

/** A hasher whose hashes the test settles one by one, in call order. */
export function fakeHasher() {
	const calls: { member: ListingEntry, resolve: (hash: string) => void, reject: (error: Error) => void }[] = []
	const hashImage = (member: ListingEntry) => new Promise<string>((resolve, reject) => calls.push({ member, resolve, reject }))
	return { calls, hashImage }
}

/** A `useVisualHashes` over `entries`, with a hasher the test settles, the saves it sent and the failures they meet in turn. */
export function setUp(entries: ListingEntry[] = BURST, stored: Record<string, string> = {}, failures: Error[] | 'always' = [], wait = async (_seconds: number) => {}) {
	const hasher = fakeHasher()
	const saves: StoredVisualHash[][] = []
	const saveVisualHashes = async (hashes: readonly StoredVisualHash[]) => {
		saves.push([...hashes])
		const failure = failures === 'always' ? new Error('offline') : failures.shift()
		if (failure !== undefined) {
			throw failure
		}
	}
	const pictures = shallowRef<Picture<ListingEntry>[]>(picturesOf(entries))
	const hashes = useVisualHashes({ hashImage: hasher.hashImage, saveVisualHashes, wait }, fakeStorage(stored), () => pictures.value)
	const byName = (name: string) => pictures.value.find((picture) => picture.baseName === name)!
	return { ...hasher, saves, pictures, hashes, byName, stored }
}
