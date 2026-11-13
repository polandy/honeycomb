// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { CullSidecars } from '../../src/cull-seams.ts'
import type { StoredTags, Tag } from '../../src/logic/tag.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCull } from '../../src/cull.ts'
import { logger } from '../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { ENTRIES, fakeStorage, SET } from './app-cull.ts'

const NO_SIDECARS: CullSidecars = { takeOver: async () => ({ decided: [], tagged: [] }), write: async () => ({ written: 0, failed: [] }), writeTags: async () => ({ written: 0, failed: [] }) }

afterEach(() => vi.restoreAllMocks())

/** A cull opened on ENTRIES with the stored tags, whose tag saves are recorded. */
async function taggedCull(stored: StoredTags[], tagList: () => Promise<Tag[]> = async () => []) {
	const saved: StoredTags[][] = []
	const saving = { fails: false }
	const cull = useCull({
		hashImage: () => new Promise(() => undefined),
		warmPreviews: async () => undefined,
		lookupDecisions: async () => [],
		saveDecisions: async () => undefined,
		tags: {
			lookupTags: async (fileIds) => stored.filter((row) => fileIds.includes(row.fileId)),
			saveTags: async (rows) => {
				if (saving.fails) {
					throw new Error('down')
				}
				saved.push([...rows])
			},
			loadTagList: tagList,
		},
	}, fakeStorage(), () => DEFAULT_SETTINGS, NO_SIDECARS)
	cull.open(SET, ENTRIES, [])
	await flushPromises()
	return { cull, saved, saving, picture: (name: string) => cull.pictures.value.find((picture) => picture.baseName === name)! }
}

describe('useCull: tag', () => {
	// spec: TAGS-003.10
	it('records one step over the pictures it alters, and undo and redo apply it to them only', async () => {
		const { cull, saved, picture } = await taggedCull([{ fileId: 1, tags: ['Dolomites'] }])
		const chosen = [picture('IMG_2'), picture('IMG_9'), picture('IMG_10')]

		const step = cull.tag({ added: ['Dolomites'], removed: [] }, chosen)
		await flushPromises()

		expect(step).toMatchObject({ change: { added: ['Dolomites'], removed: [] }, names: ['IMG_9', 'IMG_10'] })
		expect(saved).toEqual([[{ fileId: 4, tags: ['Dolomites'] }, { fileId: 3, tags: ['Dolomites'] }, { fileId: 2, tags: ['Dolomites'] }]])

		expect(cull.undo()).toBe(step)
		await flushPromises()
		expect(chosen.map(cull.tags.tagsOf)).toEqual([['Dolomites'], [], []])

		expect(cull.redo()).toBe(step)
		await flushPromises()
		expect(chosen.map(cull.tags.tagsOf)).toEqual([['Dolomites'], ['Dolomites'], ['Dolomites']])
	})

	// spec: TAGS-003.10
	it('shares one history with the decisions', async () => {
		const { cull, picture } = await taggedCull([])
		const decided = cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_9')])
		const tagged = cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_9')])

		expect(cull.undo()).toBe(tagged)
		expect(cull.undo()).toBe(decided)
	})

	// spec: TAGS-003.14
	it('says a failed tag save, also on undo, and clears it with the next save', async () => {
		const { cull, saving, picture } = await taggedCull([])
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		cull.tag({ added: ['Sunrise'], removed: [] }, [picture('IMG_2')])
		await flushPromises()

		saving.fails = true
		cull.undo()
		await flushPromises()
		expect(cull.saveFailed.value).toBe(true)
		expect(cull.tags.tagsOf(picture('IMG_2'))).toEqual(['Sunrise'])

		saving.fails = false
		cull.tag({ added: ['Dusk'], removed: [] }, [picture('IMG_2')])
		await flushPromises()
		expect(cull.saveFailed.value).toBe(false)
	})

	// spec: TAGS-003.11
	it('records and stores nothing for a change that alters no picture', async () => {
		const { cull, saved, picture } = await taggedCull([])

		expect(cull.tag({ added: [], removed: ['Sunrise'] }, [picture('IMG_9')])).toBeNull()
		await flushPromises()

		expect(saved).toEqual([])
		expect(cull.undo()).toBeNull()
	})
})

describe('useCull: known tags', () => {
	// spec: TAGS-003.13
	it('knows the tag list and the cull\'s tags with their levels', async () => {
		const { cull } = await taggedCull([{ fileId: 1, tags: ['People/Anna'] }], async () => ['Places/Italy/Dolomites'])

		expect(cull.tags.known.value).toEqual(['People', 'People/Anna', 'Places', 'Places/Italy', 'Places/Italy/Dolomites'])
	})

	// spec: TAGS-003.13
	it('logs a failed tag list read and knows the cull\'s tags', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, picture } = await taggedCull([{ fileId: 1, tags: ['People/Anna'] }], () => Promise.reject(new Error('down')))
		cull.tag({ added: ['Sunrise'], removed: [] }, [picture('IMG_9')])

		expect(error).toHaveBeenCalledWith('Could not read the tag list; the entry offers the tags of this cull', expect.anything())
		expect(cull.tags.known.value).toEqual(['People', 'People/Anna', 'Sunrise'])
	})
})
