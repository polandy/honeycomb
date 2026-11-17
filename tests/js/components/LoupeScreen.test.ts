// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoupeScreen from '../../../src/components/LoupeScreen.vue'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { SET } from '../app-cull.ts'
import { fakeCullContext, mountInCullContext } from '../cull-context-fake.ts'

const PICK = { kind: 'flag', flag: 'picked' } as const

/** The loupe screen over a fake context, the loupe opened at `index` unless null, the loupe itself stubbed. */
async function mountScreen(index: number | null = 1) {
	const fake = await fakeCullContext()
	const pictures = fake.context.cull.view.value
	if (index !== null) {
		fake.opening.loupe.value = { pictures, index }
	}
	const wrapper = mountInCullContext(LoupeScreen, fake.context, { PhotoLoupe: true })
	return { ...fake, wrapper, pictures, loupe: () => wrapper.findComponent(PhotoLoupe) }
}

describe('LoupeScreen', () => {
	it('shows no loupe while the grid shows', async () => {
		const { loupe } = await mountScreen(null)

		expect(loupe().exists()).toBe(false)
	})

	it('shows the open loupe\'s pictures with the cull and the settings', async () => {
		const { loupe, context, pictures } = await mountScreen()

		expect(loupe().props()).toMatchObject({
			pictures,
			index: 1,
			folderSet: SET,
			decisionOf: context.cull.decisionOf,
			seriesOf: context.cull.seriesOf.value,
			tagsOf: context.cull.tags.tagsOf,
			writabilityOf: context.cull.writabilityOf,
			storage: context.storage,
			viewState: context.viewState,
			settings: context.settings.value,
		})
	})

	it('pages and closes the loupe', async () => {
		const { loupe, opening, calls } = await mountScreen()

		loupe().vm.$emit('update:index', 2)
		await flushPromises()
		expect(loupe().props('index')).toBe(2)
		loupe().vm.$emit('close')
		await flushPromises()

		expect(opening.loupe.value).toBeNull()
		expect(loupe().exists()).toBe(false)
		expect(calls).toEqual([['reveal', 2]])
	})

	it('decides the shown picture and offers the rest of its series', async () => {
		const { loupe, pictures, calls } = await mountScreen()

		loupe().vm.$emit('decide', PICK, pictures[1])
		const [call] = calls.splice(0)
		;(call![3] as () => void)()

		expect(call!.slice(0, 3)).toEqual(['decide', PICK, [pictures[1]]])
		expect(calls).toEqual([['restOffer', PICK, pictures[1]]])
	})

	it('passes the loupe\'s other events to the context', async () => {
		const { loupe, pictures, calls, opening } = await mountScreen()
		const series = { key: 1, members: [pictures[0]!, pictures[1]!] }

		loupe().vm.$emit('toast', { message: 'Saved', action: null })
		loupe().vm.$emit('allDecided')
		loupe().vm.$emit('move')
		loupe().vm.$emit('tag', pictures[1])
		loupe().vm.$emit('updateSettings', { autoAdvance: false })
		loupe().vm.$emit('compareSeries', series, pictures[1])
		loupe().vm.$emit('pickRest', series, pictures[1])

		expect(calls).toEqual([
			['toast', 'Saved', null],
			['allDecided'],
			['moveShown', [], expect.any(Function)],
			['tag', [pictures[1]]],
			['updateSettings', { autoAdvance: false }],
			['compareSeriesOn', series, pictures[1], opening.land, 'loupe'],
			['pickRestAndLand', series, pictures[1], opening.land],
		])
	})
})
