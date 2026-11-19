// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { TagChange } from '../../src/logic/tag.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { useCullTags } from '../../src/cull-tags.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_1.NEF'), listingEntry(2, '/P/IMG_1.JPG'))
const READ_ONLY = pictureOf(listingEntry(3, '/Team/IMG_3.JPG'))
const WEDDING: TagChange = { added: ['Events/Wedding'], removed: ['Places/Lisbon'] }

/** Cull tags with recorded writes whose sidecars of the `failing` pictures answer `locked`; READ_ONLY lies in a read-only folder. */
function cullTags(failing: readonly Picture<ListingEntry>[] = []) {
	const writes: { pictures: Picture<ListingEntry>[], change: TagChange }[] = []
	const tags = useCullTags({ loadTagList: async () => [] }, async (pictures, change) => {
		writes.push({ pictures: [...pictures], change })
		return { failed: pictures.filter((picture) => failing.includes(picture)).map((picture) => ({ picture, path: `${picture.folder}/${picture.baseName}.xmp`, reason: 'locked' as const })) }
	}, (picture) => picture !== READ_ONLY)
	return { tags, writes }
}

describe('useCullTags: reset', () => {
	it('forgets the tags of the cull before', () => {
		const { tags } = cullTags()
		tags.change([PAIR], WEDDING)

		tags.reset()

		expect(tags.tagsOf(PAIR)).toEqual([])
	})
})

describe('useCullTags: fromSidecars', () => {
	// spec: TAGS-002.2
	it('shows the sidecars\' tags for every member, without storing or writing them back', () => {
		const { tags, writes } = cullTags()

		tags.fromSidecars([{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(writes).toEqual([])
	})

	// spec: TAGS-002.4
	it('keeps tags the user gave meanwhile and the sidecars\' tags shown before', () => {
		const { tags } = cullTags()
		tags.fromSidecars([{ picture: READ_ONLY, tags: ['Kids'] }])
		tags.change([PAIR], WEDDING)

		tags.fromSidecars([{ picture: PAIR, tags: ['Old'] }, { picture: READ_ONLY, tags: ['Old'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(tags.tagsOf(READ_ONLY)).toEqual(['Kids'])
	})
})

describe('useCullTags: change', () => {
	// spec: TAGS-002.7, TAGS-002.9
	it('shows the change at once and writes the writable pictures', () => {
		const { tags, writes } = cullTags()
		tags.fromSidecars([{ picture: PAIR, tags: ['Places/Lisbon'] }])

		tags.change([PAIR, READ_ONLY], WEDDING)

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(tags.tagsOf(READ_ONLY)).toEqual(['Events/Wedding'])
		expect(writes).toEqual([{ pictures: [PAIR], change: WEDDING }])
	})

	// spec: TAGS-002.23
	it('gives a picture whose sidecar write failed its earlier tags back, and the other keeps the change', async () => {
		const OTHER = pictureOf(listingEntry(4, '/P/IMG_4.JPG'))
		const { tags } = cullTags([PAIR])
		tags.fromSidecars([{ picture: PAIR, tags: ['Places/Lisbon'] }, { picture: OTHER, tags: ['Places/Lisbon'] }])

		tags.change([PAIR, OTHER], WEDDING)
		await flushPromises()

		expect(tags.tagsOf(PAIR)).toEqual(['Places/Lisbon'])
		expect(tags.tagsOf(OTHER)).toEqual(['Events/Wedding'])
	})

	it('writes nothing when no chosen picture is writable', () => {
		const { tags, writes } = cullTags()

		tags.change([READ_ONLY], WEDDING)

		expect(writes).toEqual([])
	})
})
