// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '../../src/components/ActionBar.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { decidedRows, mountApp, openCull, shownNames } from './app-cull.ts'
import { fakeScheduler } from './fake-scheduler.ts'

/** The app on a cull with the loupe open on IMG_10, the pair of files 2 and 3. */
async function openLoupe() {
	const scheduler = fakeScheduler()
	const mounted = mountApp({ schedule: scheduler.schedule })
	await openCull(mounted.wrapper)
	mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(mounted.wrapper).indexOf('IMG_10'))
	await flushPromises()
	const loupe = mounted.wrapper.findComponent(PhotoLoupe)
	return { ...mounted, scheduler, loupe, picture: loupe.props('pictures')[loupe.props('index')]! }
}

const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).exists() ? wrapper.findComponent(UndoToast).text() : null

enableAutoUnmount(afterEach)

describe('App: the undo toast', () => {
	afterEach(() => vi.restoreAllMocks())

	// spec: LOUPE-002.8
	it('says what a decision in the loupe changed, undoes it by Undo and says so, then goes away', async () => {
		const { wrapper, loupe, picture, scheduler } = await openLoupe()
		expect(picture.baseName).toBe('IMG_10')

		loupe.vm.$emit('decide', { kind: 'flag', flag: 'rejected' }, picture)
		await flushPromises()
		expect(toastText(wrapper)).toBe('Rejected IMG_10·Undo')
		expect(wrapper.findComponent(UndoToast).element.parentElement).toBe(document.body)
		expect(wrapper.findComponent(UndoToast).props('top')).toBe(true)

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()
		expect(loupe.props('decisionOf')(picture).flag).toBe('unflagged')
		expect(toastText(wrapper)).toBe('Undid: Rejected IMG_10')

		scheduler.fire()
		await flushPromises()
		expect(toastText(wrapper)).toBeNull()
	})

	// spec: LOUPE-002.9
	it('undoes only the latest decision, once', async () => {
		const { wrapper, loupe, picture } = await openLoupe()
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'picked' }, picture)
		loupe.vm.$emit('decide', { kind: 'rating', rating: 4 }, picture)
		await flushPromises()
		expect(toastText(wrapper)).toBe('Rated IMG_10 ★★★★·Undo')

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()

		expect(decidedRows(wrapper).map((row) => [row.fileId, row.flag, row.rating])).toEqual([[2, 'picked', 0], [3, 'picked', 0]])
		expect(wrapper.findComponent(UndoToast).findAll('button').map((button) => button.text())).not.toContain('Undo')
	})

	// spec: LOUPE-002.9
	it('shows nothing for a decision that changes nothing', async () => {
		const { wrapper, loupe, picture } = await openLoupe()
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'unflagged' }, picture)
		await flushPromises()
		expect(toastText(wrapper)).toBeNull()
	})

	it('shows the loupe\'s own messages', async () => {
		const { wrapper, loupe } = await openLoupe()
		loupe.vm.$emit('toast', { message: 'Flag buttons shown', action: null })
		await flushPromises()
		expect(toastText(wrapper)).toBe('Flag buttons shown')
	})

	it('says what a change of the selection did', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper)
		wrapper.findComponent(GridToolbar).vm.$emit('update:selecting', true)
		wrapper.findComponent(PhotoGrid).vm.$emit('update:selection', { ids: new Set([1, 4]), anchor: 4 })
		await flushPromises()

		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'flag', flag: 'picked' })
		await flushPromises()

		expect(toastText(wrapper)).toBe('Picked 2 photos·Undo')
		expect(wrapper.findComponent(UndoToast).props('top')).toBe(false)
	})
})
