// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '../../src/components/ActionBar.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { mountApp, openCull, shownNames } from './app-cull.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from './l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

/** Enters selection mode from the toolbar and selects the grid keys. */
async function select(wrapper: AppWrapper, ids: number[]) {
	wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
	wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set(ids), anchor: ids.at(-1)! })
	await flushPromises()
}

const selectedIds = (wrapper: AppWrapper) => [...wrapper.findComponent(PhotoGrid).props('selection')!.ids]
async function press(key: string, fields: KeyboardEventInit = {}) {
	window.dispatchEvent(new KeyboardEvent('keydown', { key, ...fields }))
	await flushPromises()
}

describe('App: selection mode and bulk decisions', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		vi.restoreAllMocks()
	})

	it('shows the action bar in selection mode, disabled until something is selected', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		expect(wrapper.findComponent(ActionBar).exists()).toBe(false)

		wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(true)
		expect(wrapper.findComponent(ActionBar).props('disabled')).toBe(true)
		expect(wrapper.findComponent(GridToolbar).props()).toMatchObject({ selecting: true, selected: 0 })
	})

	it('rates every member of the selected pictures, stores it and shows it', async () => {
		const { wrapper, saved } = mountApp()
		await openCull(wrapper)
		await select(wrapper, [1, 2])
		expect(wrapper.findComponent(GridToolbar).props('selected')).toBe(2)
		expect(wrapper.findComponent(ActionBar).props('common')).toMatchObject({ rating: 0, canKeepRaw: true })

		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'rating', rating: 3 })
		await flushPromises()

		expect(saved).toEqual([[1, 2, 3].map((fileId) => ({ fileId, ...UNDECIDED, rating: 3 }))])
		const decisionOf = wrapper.findComponent(PhotoGrid).props('decisionOf')!
		const pair = wrapper.findComponent(PhotoGrid).props('pictures').find((picture) => picture.baseName === 'IMG_10')!
		expect(decisionOf(pair)).toMatchObject({ rating: 3 })
		expect(wrapper.findComponent(ActionBar).props('common')).toMatchObject({ rating: 3 })
	})

	it('drops a rejected picture from the view and from the selection', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		await select(wrapper, [2, 4])

		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'flag', flag: 'rejected' })
		await flushPromises()

		expect(shownNames(wrapper)).toEqual(['IMG_2'])
		expect(selectedIds(wrapper)).toEqual([])
		expect(wrapper.findComponent(GridToolbar).props('decided')).toBe(2)
	})

	it('reverts a change the server did not store and says so', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = mountApp({ saveDecisions: () => Promise.reject(new Error('down')) })
		await openCull(wrapper)
		await select(wrapper, [1])

		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'colourLabel', colourLabel: 'red' })
		await flushPromises()

		expect(error).toHaveBeenCalledOnce()
		expect(wrapper.findComponent(ActionBar).props('common')).toMatchObject({ colourLabel: null })
		expect(wrapper.text()).toContain(`${MARK}Could not save the change; the photos show what is stored.`)
	})

	it('selects all shown, none, and leaves with the keyboard', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)

		await press('a', { ctrlKey: true })
		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(true)
		expect(selectedIds(wrapper)).toEqual([1, 4, 2])
		await press('d', { metaKey: true })
		expect(selectedIds(wrapper)).toEqual([])
		await press('Escape')
		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(false)
	})

	it('selects all and none from the toolbar, and leaves selection mode with Done', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		const toolbar = wrapper.findComponent(GridToolbar)
		toolbar.vm.$emit('update:selecting', true)

		toolbar.vm.$emit('selectAll')
		await flushPromises()
		expect(toolbar.props('selected')).toBe(3)
		toolbar.vm.$emit('selectNone')
		await flushPromises()
		expect(toolbar.props('selected')).toBe(0)
		toolbar.vm.$emit('update:selecting', false)
		await flushPromises()

		expect(wrapper.findComponent(ActionBar).exists()).toBe(false)
	})

	it('leaves the keys alone outside selection mode, in a text field and without an open cull', async () => {
		const { wrapper } = mountApp()
		await press('Escape')
		await openCull(wrapper)
		const field = document.createElement('input')
		document.body.append(field)

		field.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
		await flushPromises()
		await press('Escape')
		await press('x')

		expect(wrapper.findComponent(PhotoGrid).props('selecting')).toBe(false)
		field.remove()
	})

	it('keeps only the selected pictures the view still shows and leaves selection mode on opening a folder set', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		await select(wrapper, [1, 2])

		wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set([1, 99]), anchor: 99 })
		await flushPromises()
		expect(selectedIds(wrapper)).toEqual([1])
		await openCull(wrapper)

		expect(wrapper.findComponent(PhotoGrid).props()).toMatchObject({ selecting: false })
		expect(selectedIds(wrapper)).toEqual([])
	})

	it('removes its key listener when unmounted', async () => {
		const remove = vi.spyOn(window, 'removeEventListener')
		const { wrapper } = mountApp()

		wrapper.unmount()

		expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
	})
})
