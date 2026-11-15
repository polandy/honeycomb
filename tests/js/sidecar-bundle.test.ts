// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useBundledSidecars } from '../../src/sidecar-bundle.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
const OTHER = pictureOf(listingEntry(2, '/P/IMG_0002.NEF'), listingEntry(12, '/P/IMG_0002.NEF.xmp'))
const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '3' }), CANONICAL_TIME)

/** Bundled writes over a real sync whose endpoints are recorded, the decision each picture has now, and the page hiding. */
function bundled() {
	const scheduler = fakeScheduler()
	const lookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	let hide = () => {}
	const sync = useSidecarSync({
		lookupSidecars: async (fileIds) => {
			lookups.push([...fileIds])
			return fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'etag', size: BYTES.length, mtime: 100 }))
		},
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			saves.push([...items])
			return items.map((item) => ({ result: 'saved', fileId: 'fileId' in item ? item.fileId : 30, etag: 'saved', size: 1, mtime: 1 }))
		},
	}, () => CANONICAL_TIME, () => {})
	const sidecars = useBundledSidecars(sync, scheduler.schedule, (run) => {
		hide = run
		return () => {}
	})
	const decision = { current: { ...UNDECIDED, rating: 4 } as Decision }
	const rate = (pictures = [PAIR]) => sidecars.write(pictures, () => decision.current, ['rating'])
	return { scheduler, lookups, saves, sidecars, decision, rate, hide: () => hide() }
}

describe('useBundledSidecars', () => {
	// spec: XMP-003.25, XMP-003.28
	it('holds the steps of the shown picture, reports it waiting and writes them together once the loupe shows another', async () => {
		const { lookups, saves, sidecars, rate } = bundled()

		void rate()
		void sidecars.writeTags([PAIR], { added: ['sea'], removed: [] })
		await flushPromises()
		expect(lookups).toEqual([])
		expect(sidecars.waiting.value).toBe(PAIR)

		sidecars.leave(OTHER)
		await flushPromises()
		expect(sidecars.waiting.value).toBeNull()
		expect(lookups).toEqual([[11]])
		expect(saves).toHaveLength(1)
	})

	// spec: XMP-003.27
	it('writes a step on several pictures at once', async () => {
		const { saves, sidecars, rate } = bundled()

		await rate([PAIR, OTHER])

		expect(saves).toHaveLength(1)
		expect(sidecars.waiting.value).toBeNull()
	})

	// spec: XMP-003.29
	it('writes the waiting picture when the page turns hidden', async () => {
		const { saves, rate, hide } = bundled()
		void rate()

		hide()
		await flushPromises()

		expect(saves).toHaveLength(1)
	})

	// spec: XMP-003.31
	it('neither looks up nor saves a step undone while it waits on a picture whose sidecars honeycomb saved last', async () => {
		const { scheduler, lookups, saves, sidecars, decision, rate } = bundled()
		void rate()
		await sidecars.flush()

		decision.current = { ...UNDECIDED, rating: 5 }
		void rate()
		decision.current = { ...UNDECIDED, rating: 4 }
		void rate()
		scheduler.fire()
		await flushPromises()

		expect(lookups).toEqual([[11]])
		expect(saves).toHaveLength(1)
	})
})
