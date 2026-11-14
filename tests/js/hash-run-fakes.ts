// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HashRunSeams, MissingPicture } from '../../src/hash-run.ts'
import type { StoredVisualHash } from '../../src/logic/visual-hash.ts'

import { vi } from 'vitest'

/** A photo without a hash, as the server lists it. */
export const picture = (fileId: number): MissingPicture => ({ fileId, etag: `etag-${fileId}`, mtime: 1_700_000_000 + fileId, path: `/Photos/${fileId}.jpg` })
/** The hash a fake worker computes for a file. */
export const hashOf = (fileId: number) => fileId.toString(16).padStart(16, '0')
/** The photos of the file ids `from` to `to`. */
export const pictures = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => picture(from + index))

/** A promise settled by the test. */
export function deferred<T>() {
	let resolve!: (value: T) => void
	let reject!: (error: unknown) => void
	const promise = new Promise<T>((settle, fail) => {
		resolve = settle
		reject = fail
	})
	return { promise, resolve, reject }
}

/** Seams answering pages by cursor, hashing at once, saving every hash and waiting no time. */
export function seams(pages: Record<string, { pictures: MissingPicture[], next: string | null }>, overrides: Partial<HashRunSeams> = {}) {
	const base = {
		listMissing: vi.fn(async (_path: string, after: string) => pages[after]!),
		hash: vi.fn(async (each: MissingPicture) => hashOf(each.fileId)),
		save: vi.fn(async (hashes: readonly StoredVisualHash[]) => hashes.map((each) => each.fileId)),
		wait: vi.fn(async (_seconds: number) => {}),
		workers: 2,
	}
	return { ...base, ...overrides } as typeof base & HashRunSeams
}

/** Two pages of missing hashes, by cursor. */
export const TWO_PAGES = { '': { pictures: pictures(1, 3), next: '3.jpg' }, '3.jpg': { pictures: pictures(4, 5), next: null } }
