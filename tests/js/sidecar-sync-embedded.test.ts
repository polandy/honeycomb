// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { EmbeddedXmpAnswer } from '../../src/logic/embedded-xmp.ts'
import type { SidecarFailure, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, itemsOf, packetOf, seq, textOf } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(2, '/P/IMG_0001.JPG', { mtime: 50 }), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
const ALONE = pictureOf(listingEntry(3, '/P/B.JPG'))
const WEDDING = { added: ['Events/Wedding'], removed: [] }

/** The bytes of a packet with the tags and a rating. */
function tagged(tags: readonly string[], rating = '0'): Uint8Array {
	return serializeXmp(packetOf({ 'digiKam:TagsList': seq(tags), 'xmp:Rating': rating }), CANONICAL_TIME)
}

/** A sync whose RAW sidecar holds `Places/Lisbon` rated 3, whose JPEGs embed what `embedded` answers, and whose saves succeed. */
function sync(embedded: (fileId: number) => EmbeddedXmpAnswer | null) {
	const lookups: number[][] = []
	const embeddedLookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	const failures: SidecarFailure[][] = []
	const sidecars = useSidecarSync({
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupSidecars: async (fileIds) => {
			lookups.push([...fileIds])
			return fileIds.map(() => ({ result: 'read', bytes: tagged(['Places/Lisbon'], '3'), etag: 'e', size: 1, mtime: 100 }))
		},
		lookupEmbeddedXmp: async (fileIds) => {
			embeddedLookups.push([...fileIds])
			const answers = fileIds.map(embedded)
			if (answers.includes(null)) {
				throw new Error('offline')
			}
			return answers as EmbeddedXmpAnswer[]
		},
		saveSidecars: async (items) => {
			saves.push([...items])
			return items.map((item, index) => ({ result: 'saved', fileId: 'fileId' in item ? item.fileId : 30 + index, etag: 's', size: 1, mtime: 1 }))
		},
	}, () => CANONICAL_TIME, (failed) => failures.push([...failed]))
	return { sidecars, lookups, embeddedLookups, saves, failures }
}

const tagsOf = (item: SidecarSaveItem) => itemsOf(readXmp(item.bytes), 'digiKam:TagsList')

describe('useSidecarSync: the embedded XMP in a decision write', () => {
	// spec: XMP-003.22
	it('starts the JPEG\'s new sidecar from the embedded decision', async () => {
		const { sidecars, embeddedLookups, saves } = sync(() => ({ result: 'read', bytes: tagged([], '4') }))

		await sidecars.write([ALONE], () => ({ rating: 4, flag: 'picked', colourLabel: null, keepRaw: false }), ['flag'])

		expect(embeddedLookups).toEqual([[3]])
		expect(saves.map((items) => items.map((item) => [textOf(readXmp(item.bytes), 'xmp:Rating'), textOf(readXmp(item.bytes), 'digiKam:PickLabel')]))).toEqual([[['4', '3']]])
	})

	// spec: XMP-003.24
	it('writes nothing for a picture whose embedded lookup failed', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { sidecars, saves, failures } = sync(() => null)

		await sidecars.write([ALONE], () => ({ rating: 1, flag: 'unflagged', colourLabel: null, keepRaw: false }), ['rating'])

		expect(saves).toEqual([])
		expect(failures).toEqual([[{ path: '/P/B.JPG.xmp', picture: ALONE, reason: 'unreachable', fields: ['rating'] }]])
		error.mockRestore()
	})
})

describe('useSidecarSync: the embedded XMP in a tag write', () => {
	// spec: TAGS-002.18, TAGS-002.19
	it('writes the change applied to the embedded tags, then no longer looks the embedded XMP up', async () => {
		const { sidecars, embeddedLookups, saves } = sync(() => ({ result: 'read', bytes: tagged(['People/Anna']) }))

		await sidecars.writeTags([PAIR], WEDDING)
		await sidecars.writeTags([PAIR], { added: [], removed: ['People/Anna'] })

		expect(embeddedLookups).toEqual([[2]])
		expect(saves[0]!.map(tagsOf)).toEqual([['Events/Wedding', 'People/Anna', 'Places/Lisbon'], ['Events/Wedding', 'People/Anna', 'Places/Lisbon']])
		expect(saves[1]!.map(tagsOf)).toEqual([['Events/Wedding', 'Places/Lisbon'], ['Events/Wedding', 'Places/Lisbon']])
	})

	// spec: TAGS-002.20
	it('writes nothing for a picture whose embedded lookup failed and reports it', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { sidecars, embeddedLookups, saves, failures } = sync(() => null)

		await sidecars.writeTags([ALONE], WEDDING)

		expect(failures).toEqual([[{ path: '/P/B.JPG.xmp', picture: ALONE, reason: 'unreachable', tags: WEDDING }]])
		expect(embeddedLookups).toEqual([[3]])
		expect(saves).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not look up the embedded XMP to write', expect.anything())
		error.mockRestore()
	})
})
