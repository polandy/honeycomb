import type { StoredTags } from '../../src/logic/tag.ts'
// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ActionBar from '../../src/components/ActionBar.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import SeriesCompareFlow from '../../src/components/SeriesCompareFlow.vue'
import TagEntry from '../../src/components/TagEntry.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { mountApp, openCull, shownNames } from './app-cull.ts'

/** Presses a key on the page and returns whether the app handled it. */
async function press(key: string) {
	const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
	document.body.dispatchEvent(event)
	await flushPromises()
	return event.defaultPrevented
}

/** The app on an open cull of IMG_2, IMG_9 and IMG_10 whose tag saves are recorded. */
async function openApp() {
	const savedTags: StoredTags[][] = []
	const saveTags = async (rows: StoredTags[]) => {
		savedTags.push(rows)
	}
	const mounted = mountApp({ tags: { lookupTags: async () => [], saveTags, loadTagList: async () => ['Places/Italy'] } })
	await openCull(mounted.wrapper)
	expect(shownNames(mounted.wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	return { ...mounted, savedTags }
}

const entry = (wrapper: AppWrapper) => wrapper.findComponent(TagEntry)
const targetCount = (wrapper: AppWrapper) => entry(wrapper).props('targets').length
const pictureAt = (wrapper: AppWrapper, at: number) => wrapper.findComponent(PhotoGrid).props('pictures')[at]!

/** Enters selection mode and selects the grid keys. */
async function select(wrapper: AppWrapper, ...ids: number[]) {
	wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
	wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set(ids), anchor: ids.at(-1)! })
	await flushPromises()
}

enableAutoUnmount(afterEach)

describe('App: tag entry', () => {
	// spec: TAGS-003.1, TAGS-003.10
	it('opens by T for the selection, tags it with one toast and keeps the app keys away', async () => {
		const { wrapper, savedTags, saved } = await openApp()
		await select(wrapper, 1, 4)

		expect(await press('t')).toBe(true)
		expect(targetCount(wrapper)).toBe(2)
		expect(entry(wrapper).props('known')).toEqual(['Places', 'Places/Italy'])
		expect(await press('p')).toBe(false)

		entry(wrapper).vm.$emit('change', { added: ['Sunrise'], removed: [] })
		await flushPromises()

		expect(savedTags).toEqual([[{ fileId: 1, tags: ['Sunrise'] }, { fileId: 4, tags: ['Sunrise'] }]])
		expect(saved).toEqual([])
		expect(wrapper.findComponent(UndoToast).text()).toBe('Tagged 2 photos Sunrise·Undo')
		expect(entry(wrapper).props('targets')).toEqual([['Sunrise'], ['Sunrise']])
	})

	// spec: TAGS-003.1
	it('opens by T for the focused photo outside selection mode', async () => {
		const { wrapper, grid } = await openApp()
		grid.focused = 2

		await press('t')

		expect(targetCount(wrapper)).toBe(1)
		entry(wrapper).vm.$emit('change', { added: ['Anna'], removed: [] })
		await flushPromises()
		expect(wrapper.findComponent(UndoToast).text()).toBe('Tagged IMG_10 Anna·Undo')
	})

	// spec: TAGS-003.2
	it('opens by Tags in the selection\'s action bar', async () => {
		const { wrapper } = await openApp()
		await select(wrapper, 2)

		wrapper.findComponent(ActionBar).vm.$emit('tag')
		await flushPromises()

		expect(targetCount(wrapper)).toBe(1)
	})

	// spec: TAGS-003.1, TAGS-003.12
	it('opens for the loupe\'s and the series viewer\'s photo, and closes', async () => {
		const { wrapper } = await openApp()
		await press('e')
		wrapper.findComponent(PhotoLoupe).vm.$emit('tag', pictureAt(wrapper, 1))
		await flushPromises()
		expect(targetCount(wrapper)).toBe(1)

		entry(wrapper).vm.$emit('close')
		await flushPromises()
		expect(entry(wrapper).exists()).toBe(false)
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(true)

		wrapper.findComponent(SeriesCompareFlow).vm.$emit('tag', pictureAt(wrapper, 2))
		await flushPromises()
		expect(targetCount(wrapper)).toBe(1)
	})

	it('opens for nothing when nothing is chosen', async () => {
		const { wrapper } = await openApp()
		await select(wrapper)

		expect(await press('t')).toBe(false)

		expect(entry(wrapper).exists()).toBe(false)
	})
})
