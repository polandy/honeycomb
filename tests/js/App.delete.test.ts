// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { TrashRequestFile } from '../../src/logic/trash-report.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ActionBar from '../../src/components/ActionBar.vue'
import ConfirmDialog from '../../src/components/ConfirmDialog.vue'
import DeleteSummary from '../../src/components/DeleteSummary.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import RawRemovalSummary from '../../src/components/RawRemovalSummary.vue'
import RejectReview from '../../src/components/RejectReview.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { mountApp, openCull, shownNames, stored } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'

const REJECTED = [stored(1, 'rejected'), stored(2, 'rejected'), stored(3, 'rejected')]

/** The app on a cull with IMG_2 and IMG_10 rejected, so the grid shows IMG_9; the trash endpoint trashes every file. */
async function openApp(decisions: StoredDecision[] = REJECTED) {
	const sent: TrashRequestFile[][][] = []
	const trashPictures = async (request: TrashRequestFile[][]) => {
		sent.push(request)
		return request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' })))
	}
	const mounted = mountApp({ trashPictures, schedule: fakeScheduler().schedule }, decisions, { NcDialog: DialogStub })
	await openCull(mounted.wrapper)
	return { ...mounted, sent }
}

async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

async function openLoupe(wrapper: AppWrapper) {
	wrapper.findComponent(PhotoGrid).vm.$emit('open', 0)
	await flushPromises()
	return wrapper.findComponent(PhotoLoupe)
}

const names = (pictures: readonly { baseName: string }[]) => pictures.map((picture) => picture.baseName)
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()
const summaryOf = (wrapper: AppWrapper) => wrapper.findComponent(DeleteSummary)

enableAutoUnmount(afterEach)

describe('App: deleting rejects', () => {
	// spec: DELETE-002.1
	it('reviews the rejects from the toolbar, rescues one, and moves the rest to the trash bin', async () => {
		const { wrapper, sent } = await openApp()
		const toolbar = wrapper.findComponent(GridToolbar)
		expect(toolbar.props('rejected')).toBe(2)

		toolbar.vm.$emit('reviewRejects')
		await flushPromises()
		const review = wrapper.findComponent(RejectReview)
		expect(names(review.props('pictures'))).toEqual(['IMG_2', 'IMG_10'])
		review.vm.$emit('rescue', review.props('pictures')[0])
		await flushPromises()
		expect(names(review.props('pictures'))).toEqual(['IMG_10'])
		expect(toastText(wrapper)).toContain('IMG_2')

		review.vm.$emit('confirm')
		await flushPromises()
		expect(summaryOf(wrapper).props('fromReview')).toBe(true)
		summaryOf(wrapper).vm.$emit('confirm')
		await flushPromises()

		expect(sent).toEqual([[[{ fileId: 2, etag: 'etag-2' }, { fileId: 3, etag: 'etag-3' }]]])
		expect(summaryOf(wrapper).exists()).toBe(false)
		expect(toolbar.props('rejected')).toBe(0)
		expect(toolbar.props('total')).toBe(2)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9'])
		expect(toastText(wrapper)).toContain('Moved 1 photo · 2 files')
	})

	// spec: DELETE-002.2
	it('reviews the rejects by Ctrl+Backspace, closing the loupe first, and holds the cull keys while a dialog is open', async () => {
		const { wrapper } = await openApp()
		await openLoupe(wrapper)

		await press('Backspace', { ctrlKey: true })
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
		expect(wrapper.findComponent(RejectReview).exists()).toBe(true)

		await press('Delete')
		expect(summaryOf(wrapper).exists()).toBe(false)
		wrapper.findComponent(RejectReview).vm.$emit('cancel')
		await flushPromises()
		expect(wrapper.findComponent(RejectReview).exists()).toBe(false)
	})

	// spec: DELETE-002.3
	it('offers the review in the empty grid and after the loupe decided the last photo, never without rejects', async () => {
		const { wrapper } = await openApp([...REJECTED, stored(4, 'picked')])
		const loupe = await openLoupe(wrapper)
		loupe.vm.$emit('allDecided')
		await flushPromises()
		expect(toastText(wrapper)).toBe('All photos decided·Review rejects')
		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		await flushPromises()
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
		wrapper.findComponent(RejectReview).vm.$emit('cancel')

		wrapper.findComponent(GridToolbar).vm.$emit('update:scope', 'undecided')
		await flushPromises()
		const button = wrapper.findAll('button').find((each) => each.text() === 'Review rejects')!
		await button.trigger('click')
		expect(wrapper.findComponent(RejectReview).exists()).toBe(true)

		const none = await openApp([stored(4, 'picked'), stored(1, 'picked'), stored(2, 'picked'), stored(3, 'picked')])
		none.wrapper.findComponent(GridToolbar).vm.$emit('update:scope', 'undecided')
		await flushPromises()
		expect(none.wrapper.findAll('button').map((each) => each.text())).not.toContain('Review rejects')
	})
})

describe('App: the Delete key and Delete…', () => {
	// spec: DELETE-002.5
	it('summarises the focused tile, and the selection from the action bar and the key', async () => {
		const { wrapper } = await openApp([])
		await press('Delete')
		expect(names(summaryOf(wrapper).props('pictures'))).toEqual(['IMG_2'])
		expect(summaryOf(wrapper).props('fromReview')).toBe(false)
		summaryOf(wrapper).vm.$emit('cancel')
		await flushPromises()

		const toolbar = wrapper.findComponent(GridToolbar)
		toolbar.vm.$emit('update:selecting', true)
		toolbar.vm.$emit('selectAll')
		await flushPromises()
		await wrapper.findComponent(ActionBar).findAll('button').find((each) => each.text() === 'Delete…')!.trigger('click')
		expect(names(summaryOf(wrapper).props('pictures'))).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		summaryOf(wrapper).vm.$emit('cancel')
		await flushPromises()
		await press('Delete')
		expect(names(summaryOf(wrapper).props('pictures'))).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	})

	// spec: DELETE-002.5, DELETE-002.8
	it('deletes the loupe\'s photo and closes the loupe when no photo is left in it', async () => {
		const { wrapper, sent } = await openApp()
		await openLoupe(wrapper)

		await press('Delete')
		expect(names(summaryOf(wrapper).props('pictures'))).toEqual(['IMG_9'])
		expect(summaryOf(wrapper).findComponent(ConfirmDialog).props('container')).toBe('.photo-loupe')
		summaryOf(wrapper).vm.$emit('confirm')
		await flushPromises()

		expect(sent).toEqual([[[{ fileId: 4, etag: 'etag-4' }]]])
		expect(wrapper.findComponent(PhotoLoupe).exists()).toBe(false)
	})
})

describe('App: removing RAWs', () => {
	// spec: DELETE-003.1, DELETE-003.4, DELETE-003.6
	it('removes the RAWs of the view from the More menu, after a Keep RAW toggled there and back', async () => {
		const { wrapper, sent } = await openApp([])
		const toolbar = wrapper.findComponent(GridToolbar)
		expect(toolbar.props('rawRemovable')).toBe(1)

		toolbar.vm.$emit('removeRaws')
		await flushPromises()
		const summary = wrapper.findComponent(RawRemovalSummary)
		const [pair] = summary.props('removal').removed
		summary.vm.$emit('toggle', pair)
		await flushPromises()
		expect(names(summary.props('removal').kept)).toEqual(['IMG_10'])
		expect(toolbar.props('rawRemovable')).toBe(0)
		expect(toastText(wrapper)).toContain('Marked IMG_10 Keep RAW')
		summary.vm.$emit('toggle', pair)
		await flushPromises()

		summary.vm.$emit('confirm')
		await flushPromises()

		expect(sent).toEqual([[[{ fileId: 3, etag: 'etag-3' }]]])
		expect(wrapper.findComponent(RawRemovalSummary).exists()).toBe(false)
		expect(toolbar.props('rawRemovable')).toBe(0)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		expect(toastText(wrapper)).toContain('Removed the RAWs of 1 photo · 1 file')
	})

	// spec: DELETE-002.12
	it('does not bring pictures back with Ctrl+Z after Delete… or Remove RAWs', async () => {
		const { wrapper } = await openApp()
		await press('Backspace', { ctrlKey: true })
		wrapper.findComponent(RejectReview).vm.$emit('confirm')
		await flushPromises()
		summaryOf(wrapper).vm.$emit('confirm')
		await flushPromises()
		const afterDelete = shownNames(wrapper)
		expect(afterDelete).toEqual(['IMG_9'])

		await press('z', { ctrlKey: true })
		expect(shownNames(wrapper)).toEqual(afterDelete)

		const raws = await openApp([])
		raws.wrapper.findComponent(GridToolbar).vm.$emit('removeRaws')
		await flushPromises()
		raws.wrapper.findComponent(RawRemovalSummary).vm.$emit('confirm')
		await flushPromises()
		expect(raws.wrapper.findComponent(GridToolbar).props('rawRemovable')).toBe(0)

		await press('z', { ctrlKey: true })
		expect(raws.wrapper.findComponent(GridToolbar).props('rawRemovable')).toBe(0)
		expect(shownNames(raws.wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	})
})
