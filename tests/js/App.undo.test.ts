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
import { logger } from '../../src/logger.ts'
import { mountApp, openCull, shownNames, stored } from './app-cull.ts'
import { fakeScheduler } from './fake-scheduler.ts'

/** The app on a cull with the loupe open on IMG_10, the pair of files 2 and 3. */
async function openLoupe(saveDecisions?: () => Promise<void>) {
	const scheduler = fakeScheduler()
	const mounted = mountApp({ schedule: scheduler.schedule, ...(saveDecisions && { saveDecisions }) })
	await openCull(mounted.wrapper)
	mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(mounted.wrapper).indexOf('IMG_10'))
	await flushPromises()
	const loupe = mounted.wrapper.findComponent(PhotoLoupe)
	return { ...mounted, scheduler, loupe, picture: loupe.props('pictures')[loupe.props('index')]! }
}

const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).exists() ? wrapper.findComponent(UndoToast).text() : null
const pair = (flag: Parameters<typeof stored>[1]) => [stored(2, flag), stored(3, flag)]

enableAutoUnmount(afterEach)

describe('App: the undo toast', () => {
	afterEach(() => vi.restoreAllMocks())

	it('says what a decision in the loupe changed, undoes it by Undo and says so, then goes away', async () => {
		const { wrapper, loupe, picture, saved, scheduler } = await openLoupe()
		expect(picture.baseName).toBe('IMG_10')

		loupe.vm.$emit('decide', { kind: 'flag', flag: 'rejected' }, picture)
		await flushPromises()
		expect(toastText(wrapper)).toBe('Rejected IMG_10·Undo')
		expect(wrapper.findComponent(UndoToast).element.parentElement).toBe(document.body)
		expect(wrapper.findComponent(UndoToast).props('top')).toBe(true)

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()
		expect(saved).toEqual([pair('rejected'), pair('unflagged')])
		expect(loupe.props('decisionOf')(picture).flag).toBe('unflagged')
		expect(toastText(wrapper)).toBe('Undid: Rejected IMG_10')

		scheduler.fire()
		await flushPromises()
		expect(toastText(wrapper)).toBeNull()
	})

	it('undoes only the latest decision, once', async () => {
		const { wrapper, loupe, picture, saved } = await openLoupe()
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'picked' }, picture)
		loupe.vm.$emit('decide', { kind: 'rating', rating: 4 }, picture)
		await flushPromises()
		expect(toastText(wrapper)).toBe('Rated IMG_10 ★★★★·Undo')

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()

		expect(saved.at(-1)!.map((row) => [row.flag, row.rating])).toEqual([['picked', 0], ['picked', 0]])
		expect(wrapper.findComponent(UndoToast).find('button').exists()).toBe(false)
	})

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

	it('puts the decision back when the server does not store the undo, and says so', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		let calls = 0
		const { wrapper, loupe, picture } = await openLoupe(async () => {
			calls += 1
			if (calls > 1) {
				throw new Error('down')
			}
		})
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'rejected' }, picture)
		await flushPromises()

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()

		expect(loupe.props('decisionOf')(picture).flag).toBe('rejected')
		expect(wrapper.text()).toContain('Could not save the change')
	})
})
