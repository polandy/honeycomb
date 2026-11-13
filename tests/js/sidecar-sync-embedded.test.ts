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
import { CANONICAL_TIME, itemsOf, packetOf, seq } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF', { mime: 'image/x-nikon-nef' }), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
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

describe('useSidecarSync: the embedded XMP in the take-over', () => {
	// spec: TAGS-002.15
	it('takes the embedded tags over with the sidecars\', also for a JPEG without sidecars', async () => {
		const { sidecars, lookups, embeddedLookups } = sync((fileId) => ({ result: 'read', bytes: tagged(fileId === 2 ? ['People/Anna'] : ['Kids']) }))

		const { decided, tagged: taken } = await sidecars.takeOver([PAIR, ALONE], new Set(), new Set())

		expect(lookups).toEqual([[11]])
		expect(embeddedLookups).toEqual([[2, 3]])
		expect(decided.map(({ picture, decision }) => [picture, decision.rating])).toEqual([[PAIR, 3]])
		expect(taken).toEqual([{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }, { picture: ALONE, tags: ['Kids'] }])
	})

	// spec: TAGS-002.16
	it('looks nothing up while the stored tags are unknown, and no sidecars for a JPEG alone', async () => {
		const { sidecars, lookups, embeddedLookups } = sync(() => ({ result: 'none' }))

		expect(await sidecars.takeOver([ALONE], new Set(), null)).toEqual({ decided: [], tagged: [] })
		expect(await sidecars.takeOver([ALONE], new Set(), new Set())).toEqual({ decided: [], tagged: [] })
		expect(lookups).toEqual([])
		expect(embeddedLookups).toEqual([[3]])
	})

	// spec: TAGS-002.17
	it('warns and takes no tags over when the embedded lookup fails, but still the decisions', async () => {
		const warn = vi.spyOn(logger, 'warn').mockImplementation(() => undefined)
		const { sidecars } = sync(() => null)

		const { decided, tagged: taken } = await sidecars.takeOver([PAIR], new Set(), new Set())

		expect(decided).toHaveLength(1)
		expect(taken).toEqual([])
		expect(warn).toHaveBeenCalledWith('Could not look up the embedded XMP; its pictures take no tags over', expect.anything())
		expect(warn).toHaveBeenCalledWith('Could not read the embedded XMP; the picture takes no tags over', { path: '/P/IMG_0001.JPG', reason: 'unreachable' })
		warn.mockRestore()
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
	it('writes nothing for a picture whose embedded lookup failed, and looks it up again on retry', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const answers = [null, { result: 'none' as const }]
		const { sidecars, embeddedLookups, saves, failures } = sync(() => answers[embeddedLookups.length - 1]!)

		await sidecars.writeTags([ALONE], WEDDING)
		await sidecars.retry(failures[0]!, () => {
			throw new Error('no decision')
		})

		expect(failures).toEqual([[{ path: '/P/B.JPG.xmp', picture: ALONE, reason: 'unreachable', tags: WEDDING }]])
		expect(embeddedLookups).toEqual([[3], [3]])
		expect(saves.map((items) => items.map(tagsOf))).toEqual([[['Events/Wedding']]])
		expect(error).toHaveBeenCalledWith('Could not look up the embedded XMP to write', expect.anything())
		error.mockRestore()
	})
})
