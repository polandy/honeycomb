// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ENTRIES, SET } from './app-cull.ts'
import { access, cullWith } from './cull-sidecars-fake.ts'

describe('useCull: tags', () => {
	// spec: TAGS-002.2
	it('reads the sidecars once and shows their tags', async () => {
		const { cull, reads, picture } = cullWith({ tagsTakenOver: new Map([['IMG_10', ['Places/Lisbon']], ['IMG_9', ['Anna']]]) })

		cull.open(SET, ENTRIES)
		await flushPromises()

		expect(reads).toHaveLength(1)
		expect(cull.tags.tagsOf(picture('IMG_9'))).toEqual(['Anna'])
		expect(cull.tags.tagsOf(picture('IMG_10'))).toEqual(['Places/Lisbon'])
		expect(cull.tags.tagsOf(picture('IMG_2'))).toEqual([])
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
		const { cull, reads } = cullWith({ tagsTakenOver: new Map([['IMG_10', ['Anna']]]) })
		cull.open(SET, ENTRIES)
		await flushPromises()
		const pair = cull.pictures.value.find((each) => each.baseName === 'IMG_10')!
		cull.restoreFiles([{ ...pair.raw!, fileId: 103 }])
		await flushPromises()

		expect(reads.at(-1)).toEqual(['IMG_10'])
		expect(cull.tags.tagsOf(cull.pictures.value.find((each) => each.baseName === 'IMG_10')!)).toEqual(['Anna'])
	})
})
