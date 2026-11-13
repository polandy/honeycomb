// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { StoredTags, TagChange } from '../../src/logic/tag.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { useCullTags } from '../../src/cull-tags.ts'
import { logger } from '../../src/logger.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_1.NEF'), listingEntry(2, '/P/IMG_1.JPG'))
const SHARED = pictureOf(listingEntry(3, '/Team/IMG_3.JPG'))
const OPENED = [PAIR, SHARED]
const WEDDING: TagChange = { added: ['Events/Wedding'], removed: ['Places/Lisbon'] }

/** Cull tags over the OPENED pictures, with recorded lookups, saves and writes; SHARED lies in a shared folder. */
function cullTags(options: { stored?: StoredTags[], lookup?: () => Promise<StoredTags[]>, save?: () => Promise<void> } = {}) {
	const lookups: number[][] = []
	const saves: StoredTags[][] = []
	const writes: { pictures: Picture<ListingEntry>[], change: TagChange }[] = []
	const current = { pictures: OPENED as readonly Picture<ListingEntry>[] }
	const tags = useCullTags({
		lookupTags: async (fileIds) => {
			lookups.push([...fileIds])
			return options.lookup ? options.lookup() : (options.stored ?? []).filter((row) => fileIds.includes(row.fileId))
		},
		saveTags: async (rows) => {
			saves.push([...rows])
			return options.save?.()
		},
		loadTagList: async () => [],
	}, async (pictures, change) => {
		writes.push({ pictures: [...pictures], change })
	}, () => current.pictures, (picture) => picture !== SHARED)
	return { tags, lookups, saves, writes, current }
}

describe('useCullTags: load', () => {
	// spec: TAGS-002.1
	it('reads the tags of every member in one request; a picture has the union of its members\'', async () => {
		const { tags, lookups } = cullTags({ stored: [{ fileId: 1, tags: ['Places/Lisbon'] }, { fileId: 2, tags: ['People/Anna', 'Places/Lisbon'] }] })

		expect(await tags.load(OPENED)).toEqual(new Set([1, 2]))

		expect(lookups).toEqual([[1, 2, 3]])
		expect(tags.tagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(tags.tagsOf(SHARED)).toEqual([])
	})

	// spec: TAGS-002.6
	it('logs a failed read and leaves the pictures untagged', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { tags } = cullTags({ lookup: () => Promise.reject(new Error('down')) })

		expect(await tags.load(OPENED)).toBeNull()

		expect(tags.tagsOf(PAIR)).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not read the tags; every photo shows as untagged', expect.anything())
	})

	it('drops the answer of a cull no longer open', async () => {
		const { tags, current } = cullTags({ stored: [{ fileId: 1, tags: ['Anna'] }] })

		const loading = tags.load(OPENED)
		current.pictures = []

		expect(await loading).toBeNull()
		expect(tags.tagsOf(PAIR)).toEqual([])
	})

	it('keeps tags given while the read was under way, and forgets everything on reset', async () => {
		let answer!: (rows: StoredTags[]) => void
		const { tags } = cullTags({
			lookup: () => new Promise((resolve) => {
				answer = resolve
			}),
		})
		const loading = tags.load(OPENED)
		await tags.change([PAIR], WEDDING)

		answer([{ fileId: 1, tags: ['Old'] }])
		await loading

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		tags.reset()
		expect(tags.tagsOf(PAIR)).toEqual([])
	})
})

describe('useCullTags: takeOver', () => {
	// spec: TAGS-002.2
	it('shows and stores the sidecars\' tags for every member in one save, without writing them back', async () => {
		const { tags, saves, writes } = cullTags()

		tags.takeOver(OPENED, [{ picture: PAIR, tags: ['People/Anna', 'Places/Lisbon'] }])
		await flushPromises()

		expect(tags.tagsOf(PAIR)).toEqual(['People/Anna', 'Places/Lisbon'])
		expect(saves).toEqual([[{ fileId: 1, tags: ['People/Anna', 'Places/Lisbon'] }, { fileId: 2, tags: ['People/Anna', 'Places/Lisbon'] }]])
		expect(writes).toEqual([])
	})

	// spec: TAGS-002.4
	it('keeps tags the user gave meanwhile, and ignores a cull no longer open', async () => {
		const { tags, saves, current } = cullTags()
		await tags.change([PAIR], WEDDING)

		tags.takeOver(OPENED, [{ picture: PAIR, tags: ['Old'] }])
		current.pictures = []
		tags.takeOver(OPENED, [{ picture: SHARED, tags: ['Old'] }])

		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(tags.tagsOf(SHARED)).toEqual([])
		expect(saves).toHaveLength(1)
	})

	it('logs a failed save of the taken-over tags', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { tags } = cullTags({ save: () => Promise.reject(new Error('down')) })

		tags.takeOver(OPENED, [{ picture: SHARED, tags: ['Anna'] }])
		await flushPromises()

		expect(error).toHaveBeenCalledWith('Could not save the tags taken over from the sidecars', expect.anything())
	})
})

describe('useCullTags: change', () => {
	// spec: TAGS-002.7, TAGS-002.12
	it('shows the change at once, stores every member in one save, then writes the pictures outside shared folders', async () => {
		const { tags, saves, writes } = cullTags({ stored: [{ fileId: 1, tags: ['Places/Lisbon'] }] })
		await tags.load(OPENED)

		const changing = tags.change([PAIR, SHARED], WEDDING)
		expect(tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])

		expect(await changing).toBe(true)
		expect(saves).toEqual([[{ fileId: 1, tags: ['Events/Wedding'] }, { fileId: 2, tags: ['Events/Wedding'] }, { fileId: 3, tags: ['Events/Wedding'] }]])
		expect(writes).toEqual([{ pictures: [PAIR], change: WEDDING }])
	})

	// spec: TAGS-002.8
	it('puts the tags back after a failed save and writes nothing', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { tags, writes } = cullTags({ stored: [{ fileId: 1, tags: ['Places/Lisbon'] }], save: () => Promise.reject(new Error('down')) })
		await tags.load(OPENED)

		expect(await tags.change([PAIR], WEDDING)).toBe(false)

		expect(tags.tagsOf(PAIR)).toEqual(['Places/Lisbon'])
		expect(writes).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not save the tags', expect.anything())
	})

	it('writes nothing for a cull closed while saving, and keeps a failed save of it closed', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const fails = cullTags({ save: () => Promise.reject(new Error('down')) })
		const closes = cullTags()

		const failing = fails.tags.change([PAIR], WEDDING)
		fails.current.pictures = []
		const saving = closes.tags.change([PAIR], WEDDING)
		closes.current.pictures = []

		expect(await failing).toBe(false)
		expect(await saving).toBe(true)
		expect(fails.tags.tagsOf(PAIR)).toEqual(['Events/Wedding'])
		expect(closes.writes).toEqual([])
	})
})

describe('useCullTags: restore', () => {
	// spec: TAGS-002.14
	it('reads the tags of files put back that it does not know', async () => {
		const { tags, lookups } = cullTags({ stored: [{ fileId: 1, tags: ['Anna'] }, { fileId: 3, tags: ['Kids'] }] })
		await tags.change([SHARED], { added: ['Mine'], removed: [] })

		tags.restore([1, 3])
		await flushPromises()

		expect(lookups).toEqual([[1]])
		expect(tags.tagsOf(PAIR)).toEqual(['Anna'])
		expect(tags.tagsOf(SHARED)).toEqual(['Mine'])
	})

	it('logs a failed read of the files put back', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { tags } = cullTags({ lookup: () => Promise.reject(new Error('down')) })

		tags.restore([1])
		await flushPromises()

		expect(error).toHaveBeenCalledWith('Could not read the tags of the photos moved back', expect.anything())
	})
})
