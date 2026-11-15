// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith } from './cull-sidecars-fake.ts'

describe('useCull: tags', () => {
	// spec: TAGS-002.1, TAGS-002.2
	it('reads the stored tags, then shows and stores the sidecars\' tags of the pictures without', async () => {
		const { cull, takeOvers, savedTags, tagLookups, picture } = cullWith({ storedTags: [{ fileId: 4, tags: ['Anna'] }], tagsTakenOver: new Map([['IMG_10', ['Places/Lisbon']]]) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(tagLookups).toEqual([[1, 3, 2, 4]])
		expect(takeOvers.map(({ tagged }) => tagged)).toEqual([[4]])
		expect(cull.tags.tagsOf(picture('IMG_9'))).toEqual(['Anna'])
		expect(cull.tags.tagsOf(picture('IMG_10'))).toEqual(['Places/Lisbon'])
		expect(savedTags).toEqual([[{ fileId: 3, tags: ['Places/Lisbon'] }, { fileId: 2, tags: ['Places/Lisbon'] }]])
	})

	// spec: TAGS-002.6
	it('takes no tags over when their read fails, and still loads the decisions', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, takeOvers, picture } = cullWith({ stored: [stored(4, 'picked')], tagLookupFails: true })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(takeOvers.map(({ tagged }) => tagged)).toEqual([null])
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
	})

	// spec: TAGS-002.9, TAGS-002.12
	it('writes a tag change through outside shared folders only', async () => {
		const { cull, tagWrites, picture } = cullWith()
		const change = { added: ['Anna'], removed: [] }
		cull.open(SET, ENTRIES, access({ '/Trip/B': { shared: true } }))
		await flushPromises()

		await cull.tags.change([picture('IMG_2'), picture('IMG_10')], change)

		expect(tagWrites).toEqual([{ names: ['IMG_10'], change }])
	})

	// spec: TAGS-002.14
	it('reads the tags of files moved back', async () => {
		const { cull, tagLookups } = cullWith()
		cull.open(SET, ENTRIES)
		await flushPromises()
		const pair = cull.pictures.value.find((each) => each.baseName === 'IMG_10')!
		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }])
		await flushPromises()

		expect(tagLookups.at(-1)).toEqual([103])
	})
})
