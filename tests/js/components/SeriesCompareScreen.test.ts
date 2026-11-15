// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Component } from 'vue'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'
import SeriesCompare from '../../../src/components/SeriesCompare.vue'
import SeriesCompareScreen from '../../../src/components/SeriesCompareScreen.vue'
import SeriesViewer from '../../../src/components/SeriesViewer.vue'
import { fakeCullContext, mountInCullContext } from '../cull-context-fake.ts'

const PICK = { kind: 'flag', flag: 'picked' } as const
const VIEWER_KEYS = { close: () => undefined }
/** A series viewer that exposes its keys, as the real one does. */
const VIEWER_STUB = defineComponent({ setup: (_props, { expose }) => {
	expose({ hotkeys: VIEWER_KEYS })
	return () => null
} })

/** The compare screen over a fake context, the compare and its viewer stubbed. */
async function mountScreen(stubs: Record<string, Component | boolean> = {}) {
	const fake = await fakeCullContext()
	const pictures = fake.context.cull.view.value
	const wrapper = mountInCullContext(SeriesCompareScreen, fake.context, { SeriesCompare: true, SeriesViewer: true, teleport: true, ...stubs })
	const series = { key: 1, members: [pictures[0]!, pictures[1]!] }
	/** Opens the compare on the series from the loupe, as its chip does. */
	const openOnSeries = async () => {
		fake.flow.startOn(series, pictures[1]!, fake.opening.land)
		await flushPromises()
	}
	return { ...fake, wrapper, pictures, series, openOnSeries, compare: () => wrapper.findComponent(SeriesCompare), viewer: () => wrapper.findComponent(SeriesViewer) }
}

describe('SeriesCompareScreen', () => {
	it('shows no compare while it is closed', async () => {
		const { compare, viewer } = await mountScreen()

		expect(compare().exists()).toBe(false)
		expect(viewer().exists()).toBe(false)
	})

	it('shows the compare over the page when the grid opened it', async () => {
		const { compare, flow } = await mountScreen()

		flow.start()
		await flushPromises()

		expect(compare().props()).toMatchObject({ oneSeries: false, container: 'body' })
	})

	it('shows the opened series inside the loupe with the cull\'s decisions', async () => {
		const { compare, context, series, openOnSeries } = await mountScreen()

		await openOnSeries()

		expect(compare().props()).toMatchObject({
			series,
			position: 0,
			count: 1,
			active: 1,
			decisionOf: context.cull.decisionOf,
			oneSeries: true,
			container: '.photo-loupe',
		})
	})

	it('passes the compare\'s events to the flow', async () => {
		const { compare, calls, pictures, openOnSeries } = await mountScreen()
		await openOnSeries()
		calls.splice(0)

		compare().vm.$emit('activate', 0)
		compare().vm.$emit('columns', 2)
		compare().vm.$emit('decide', PICK, pictures[0])
		compare().vm.$emit('pickRest', pictures[1])
		await flushPromises()

		expect(compare().props('active')).toBe(0)
		expect(calls).toEqual([
			['compareDecide', PICK, pictures[0], false],
			['comparePickRest', pictures[1], [pictures[0]]],
		])
	})

	it('closes the compare', async () => {
		const { compare, openOnSeries } = await mountScreen()
		await openOnSeries()

		compare().vm.$emit('close')
		await flushPromises()

		expect(compare().exists()).toBe(false)
	})

	it('opens the viewer on a picture and passes its events to the flow and the tag entry', async () => {
		const { compare, viewer, calls, pictures, context, openOnSeries } = await mountScreen()
		await openOnSeries()
		compare().vm.$emit('view', 1)
		await flushPromises()
		expect(compare().exists()).toBe(false)
		expect(viewer().props()).toMatchObject({ pictures: [pictures[0], pictures[1]], index: 1, position: 0, count: 1, decisionOf: context.cull.decisionOf, settings: context.settings.value })
		calls.splice(0)

		viewer().vm.$emit('update:index', 0)
		await flushPromises()
		expect(viewer().props('index')).toBe(0)
		viewer().vm.$emit('decide', PICK, pictures[0])
		viewer().vm.$emit('toast', { message: 'Saved', action: null })
		viewer().vm.$emit('updateSettings', { autoAdvance: false })
		viewer().vm.$emit('tag', pictures[0])
		viewer().vm.$emit('close')
		await flushPromises()

		expect(calls).toEqual([
			['compareDecide', PICK, pictures[0], true],
			['toast', 'Saved', null],
			['updateSettings', { autoAdvance: false }],
			['tag', [pictures[0]]],
		])
		expect(viewer().exists()).toBe(false)
		expect(compare().exists()).toBe(true)
	})

	it('exposes the viewer\'s keys while it is open, else the compare\'s', async () => {
		const { wrapper, compare, flow, openOnSeries } = await mountScreen({ SeriesViewer: VIEWER_STUB })
		await openOnSeries()
		const screen = wrapper.findComponent(SeriesCompareScreen)
		expect(screen.vm.hotkeys()).toBe(flow.hotkeys)

		compare().vm.$emit('view', 0)
		await flushPromises()

		expect(screen.vm.hotkeys()).toBe(VIEWER_KEYS)
	})
})
