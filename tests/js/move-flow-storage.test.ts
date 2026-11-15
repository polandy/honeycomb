// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { allMoved, moveFlow } from './move-fixtures.ts'

describe('useMoveFlow: storages', () => {
	// spec: MOVE-004.16
	it('probes the folders the pictures are in', async () => {
		const { moving, pair, single, sources } = moveFlow()
		moving.open([pair, single])

		moving.choose('/Out')
		await flushPromises()

		expect(sources).toEqual([['/Trip']])
	})

	// spec: MOVE-004.16
	it('keeps out every picture whose target is on another storage than its folder', async () => {
		const { moving, pair, single, sent } = moveFlow(allMoved(), { storages: { '/Trip': '/Trip' } })
		moving.open([pair, single])

		moving.choose('/Out')
		await flushPromises()

		expect(moving.leaving.value).toEqual(new Set([pair, single]))
		expect(moving.plan.value).toEqual([])
		expect(moving.counts.value).toEqual({ files: 0, conflicts: 0 })
		await moving.confirm()
		expect(sent).toEqual([])
	})

	// spec: MOVE-004.16
	it('moves the pictures that stay on their storage', async () => {
		const { moving, pair, sent } = moveFlow(allMoved(), { storages: { '/Trip': '/Trip', '/Trip/Best': '/Trip' } })
		moving.open([pair])

		moving.choose('/Trip/Best')
		await flushPromises()

		expect(moving.leaving.value).toEqual(new Set())
		await moving.confirm()
		expect(sent.flat(2).map((file) => file.path)).toEqual(['/Trip/Best/IMG_1.JPG', '/Trip/Best/IMG_1.CR3'])
	})

	// spec: MOVE-004.16
	it('forgets which pictures leave their storage when another target is chosen', async () => {
		const { moving, pair } = moveFlow(allMoved(), { storages: { '/Trip': '/Trip' } })
		moving.open([pair])
		moving.choose('/Out')
		await flushPromises()

		moving.choose('/Trip')

		expect(moving.leaving.value).toEqual(new Set())
	})
})
