// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ENTRIES, SET } from './app-cull.ts'
import { cullWith } from './cull-sidecars-fake.ts'

describe('useCull: the counts a save carries', () => {
	// spec: STATS-001.37
	it('counts a rating, a colour label and a tag set, and takes the tag back on undo', async () => {
		const { cull, open, picture, counted } = cullWith()
		open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'rating', rating: 4 }, [picture('IMG_10')])
		cull.decide({ kind: 'colourLabel', colourLabel: 'red' }, [picture('IMG_10')])
		cull.tag({ added: ['Anna'], removed: [] }, [picture('IMG_10'), picture('IMG_9')])
		cull.undo()
		await flushPromises()

		expect(counted).toEqual([
			{ IMG_10: { ratings_set: 1 } },
			{ IMG_10: { colour_labels_set: 1 } },
			{ IMG_10: { tags_set: 1 }, IMG_9: { tags_set: 1 } },
			{ IMG_10: { tags_set: -1 }, IMG_9: { tags_set: -1 } },
		])
	})

	// spec: STATS-001.14, STATS-001.15
	it('sends a flag change on the first row of each picture, and its undo as the opposite', async () => {
		const { cull, open, picture, flags } = cullWith()
		open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10')])
		cull.undo()
		await flushPromises()

		expect(flags.saves.map((items) => items.map((item) => [item.fileId, item.counts ?? null]))).toEqual([
			[[2, { pictures_decided: 1, pictures_picked: 1 }], [3, null]],
			[[2, { pictures_decided: -1, pictures_picked: -1 }], [3, null]],
		])
	})
})
