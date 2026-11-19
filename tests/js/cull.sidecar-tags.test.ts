// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith } from './cull-sidecars-fake.ts'

describe('useCull: tags', () => {
	// spec: TAGS-002.1, TAGS-002.2, TAGS-002.3
	it('reads the stored tags with the sidecars and shows the sidecars\' tags of the pictures without', async () => {
		const { cull, reads, tagLookups, picture } = cullWith({ storedTags: [{ fileId: 4, tags: ['Anna'] }], tagsTakenOver: new Map([['IMG_10', ['Places/Lisbon']], ['IMG_9', ['Old']]]) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(tagLookups).toEqual([[1, 3, 2, 4]])
		expect(reads).toHaveLength(1)
		expect(cull.tags.tagsOf(picture('IMG_9'))).toEqual(['Anna'])
		expect(cull.tags.tagsOf(picture('IMG_10'))).toEqual(['Places/Lisbon'])
	})

	// spec: TAGS-002.6
	it('shows the sidecars\' tags when the stored read fails, and still loads the decisions', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { cull, picture } = cullWith({ stored: [stored(4, 'picked')], tagLookupFails: true, tagsTakenOver: new Map([['IMG_9', ['Trip']]]) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(cull.tags.tagsOf(picture('IMG_9'))).toEqual(['Trip'])
		expect(cull.decisionOf(picture('IMG_9')).flag).toBe('picked')
	})

	// spec: TAGS-002.9, TAGS-002.22
	it('writes a tag change through wherever the folder grants update and create, a shared one too', async () => {
		const { cull, tagWrites, picture } = cullWith()
		const change = { added: ['Anna'], removed: [] }
		cull.open(SET, ENTRIES, access({ '/Trip/A': 1 }))
		await flushPromises()

		cull.tags.change([picture('IMG_2'), picture('IMG_10')], change)

		expect(tagWrites).toEqual([{ names: ['IMG_2'], change }])
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
