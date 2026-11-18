// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { StoredTags, TagChange } from '../../src/logic/tag.ts'

import { describe, expect, it, vi } from 'vitest'
import { useCullTags } from '../../src/cull-tags.ts'
import { logger } from '../../src/logger.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_1.NEF'), listingEntry(2, '/P/IMG_1.JPG'))
const SHARED = pictureOf(listingEntry(3, '/Team/IMG_3.JPG'))
const OPENED = [PAIR, SHARED]
const WEDDING: TagChange = { added: ['Events/Wedding'], removed: ['Places/Lisbon'] }

/** Cull tags over the OPENED pictures, with recorded lookups and writes; SHARED lies in a shared folder. */
function cullTags(options: { stored?: StoredTags[], lookup?: () => Promise<StoredTags[]> } = {}) {
	const lookups: number[][] = []
	const writes: { pictures: Picture<ListingEntry>[], change: TagChange }[] = []
	const current = { pictures: OPENED as readonly Picture<ListingEntry>[] }
	const tags = useCullTags({
		lookupTags: async (fileIds) => {
			lookups.push([...fileIds])
			return options.lookup ? options.lookup() : (options.stored ?? []).filter((row) => fileIds.includes(row.fileId))
		},
		loadTagList: async () => [],
	}, async (pictures, change) => {
		writes.push({ pictures: [...pictures], change })
	}, () => current.pictures, (picture) => picture !== SHARED)
	return { tags, lookups, writes, current }
}

describe('useCullTags: load', () => {
	// spec: TAGS-002.1, XMP-007.5
	it('reads the legacy tags of every member in one request; a picture has the union of its members\'', async () => {
		const { tags, lookups } = cullTags({ stored: [{ fileId: 1, tags: ['Places/Lisbon'] }, { fileId: 2, tags: ['People/Anna', 'Places/Lisbon'] }] })

		await tags.load([1, 2, 3])

		expect(lookups).toEqual([[1, 2, 3]])
		expect(tags.tagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(tags.legacyTagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(tags.tagsOf(SHARED)).toEqual([])
	})

	// spec: TAGS-002.6
	it('logs a failed read and shows the sidecars\' tags', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { tags } = cullTags({ lookup: () => Promise.reject(new Error('down')) })

		await tags.load([1, 2, 3])
		tags.fromSidecars([{ picture: PAIR, tags: ['Trip'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['Trip'])
		expect(tags.legacyTagsOf(PAIR)).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not read the stored tags; the photos show their sidecars\' tags', expect.anything())
	})

	it('drops the answer of a cull no longer open', async () => {
		const { tags, current } = cullTags({ stored: [{ fileId: 1, tags: ['Anna'] }] })

		const loading = tags.load([1, 2, 3])
		current.pictures = []
		await loading

		expect(tags.tagsOf(PAIR)).toEqual([])
	})

	it('keeps tags given while the read was under way, and forgets everything on reset', async () => {
		let answer!: (rows: StoredTags[]) => void
		const { tags } = cullTags({
			lookup: () => new Promise((resolve) => {
				answer = resolve
			}),
		})
		const loading = tags.load([1, 2, 3])
		tags.change([PAIR], WEDDING)

		answer([{ fileId: 1, tags: ['Old'] }])
		await loading

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		tags.reset()
		expect(tags.tagsOf(PAIR)).toEqual([])
		expect(tags.legacyTagsOf(PAIR)).toEqual([])
	})

	// spec: XMP-008.11
	it('forgets the legacy tags of the files given, but keeps showing them', async () => {
		const { tags } = cullTags({ stored: [{ fileId: 1, tags: ['Anna'] }, { fileId: 3, tags: ['Kids'] }] })
		await tags.load([1, 2, 3])

		tags.forget(new Set([1, 2]))

		expect(tags.legacyTagsOf(PAIR)).toEqual([])
		expect(tags.legacyTagsOf(SHARED)).toEqual(['Kids'])
		expect(tags.tagsOf(PAIR)).toEqual(['Anna'])
	})
})

describe('useCullTags: fromSidecars', () => {
	// spec: TAGS-002.2
	it('shows the sidecars\' tags for every member, without storing or writing them back', () => {
		const { tags, writes } = cullTags()

		tags.fromSidecars([{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(tags.legacyTagsOf(PAIR)).toEqual([])
		expect(writes).toEqual([])
	})

	// spec: TAGS-002.4, XMP-003.2
	it('keeps tags the user gave meanwhile and the legacy tags', async () => {
		const { tags } = cullTags({ stored: [{ fileId: 3, tags: ['Kids'] }] })
		await tags.load([3])
		tags.change([PAIR], WEDDING)

		tags.fromSidecars([{ picture: PAIR, tags: ['Old'] }, { picture: SHARED, tags: ['Old'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(tags.tagsOf(SHARED)).toEqual(['Kids'])
	})
})

describe('useCullTags: change', () => {
	// spec: TAGS-002.7, TAGS-002.12
	it('shows the change at once and writes the pictures outside shared folders', async () => {
		const { tags, writes } = cullTags({ stored: [{ fileId: 1, tags: ['Places/Lisbon'] }] })
		await tags.load([1, 2, 3])

		tags.change([PAIR, SHARED], WEDDING)

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(tags.tagsOf(SHARED)).toEqual(['Events/Wedding'])
		expect(writes).toEqual([{ pictures: [PAIR], change: WEDDING }])
	})

	it('writes nothing when no chosen picture is writable', () => {
		const { tags, writes } = cullTags()

		tags.change([SHARED], WEDDING)

		expect(writes).toEqual([])
	})
})
