// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarWrites } from '../../src/cull-seams.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { useBundledSidecars } from '../../src/sidecar-bundle.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { ENTRIES, fakeFlags, fakeStorage, NO_SERIES, NO_SIDECARS, NO_TAGS, SAVED_SERIES, SET } from './app-cull.ts'
import { access } from './cull-sidecars-fake.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { CANONICAL_TIME } from './logic/xmp/xmp-builders.ts'

/** A cull over bundled sidecars whose writes record the pictures' names and wait until the test settles them; `over` replaces the recording writes. */
async function bundledCull(over?: SidecarWrites) {
	const settle: (() => void)[] = []
	const writes: string[][] = []
	const record = async (pictures: readonly { baseName: string }[]) => {
		writes.push(pictures.map((picture) => picture.baseName))
		await new Promise<void>((resolve) => settle.push(resolve))
		return { written: pictures.length, failed: [] }
	}
	const sidecars = useBundledSidecars(over ?? {
		...NO_SIDECARS,
		write: record,
		writeTags: record,
	}, fakeScheduler().schedule, () => () => {})
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		saveVisualHashes: async () => undefined,
		measureImage: async () => ({ sharpness: 0, focusTile: 0 }),
		saveQualityValues: async () => undefined,
		wait: async () => {},
		warmPreviews: async () => undefined,
		flags: fakeFlags().api,
		lookupSeries: NO_SERIES,
		saveSeries: SAVED_SERIES,
		tags: NO_TAGS,
	}, fakeStorage(), () => DEFAULT_SETTINGS, sidecars)
	cull.open(SET, ENTRIES, access())
	await flushPromises()
	return { cull, sidecars, settle, writes, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: flushing the sidecar writes', () => {
	// spec: XMP-003.30
	it('waits for the sidecar write of a decision still on the way', async () => {
		const { cull, sidecars, settle, writes, picture } = await bundledCull()
		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_9'), picture('IMG_2')])
		let flushed = false
		const flush = sidecars.flush().then(() => (flushed = true))

		await flushPromises()
		expect(flushed).toBe(false)

		settle[0]!()
		await flush
		expect(writes).toEqual([['IMG_2', 'IMG_9']])
	})

	// spec: XMP-003.30
	it('waits for the sidecar write of a tag change still on the way', async () => {
		const { cull, sidecars, settle, writes, picture } = await bundledCull()
		cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_9'), picture('IMG_2')])
		let flushed = false
		const flush = sidecars.flush().then(() => (flushed = true))

		await flushPromises()
		expect(flushed).toBe(false)

		settle[0]!()
		await flush
		expect(writes).toEqual([['IMG_9', 'IMG_2']])
	})

	// spec: XMP-003.30, DELETE-002.17, MOVE-004.19
	it('gives a flushed picture the sidecar honeycomb created by a write that was still on the way', async () => {
		const saving: (() => void)[] = []
		const sync = useSidecarSync({
			lookupSidecars: async () => [],
			lookupXmpCache: async () => [],
			saveXmpCache: async () => undefined,
			lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' as const })),
			saveSidecars: async (items) => {
				await new Promise<void>((resolve) => saving.push(resolve))
				return items.map(() => ({ result: 'saved' as const, fileId: 50, etag: 'created-50', size: 1, mtime: 1 }))
			},
		}, () => CANONICAL_TIME, () => {})
		const { cull, sidecars, picture } = await bundledCull(sync)
		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_2')])
		const flush = sidecars.flush()
		await flushPromises()

		saving[0]!()
		await flush
		expect(sync.current(picture('IMG_2')).sidecars.map(({ fileId, path, etag }) => [fileId, path, etag])).toEqual([[50, '/Trip/B/IMG_2.JPG.xmp', 'created-50']])
	})
})
