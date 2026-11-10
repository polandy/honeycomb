// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { MoveRequestFile, TargetFolder } from '../../src/logic/move-plan.ts'
import type { MoveFlow } from '../../src/move-flow.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ActionBar from '../../src/components/ActionBar.vue'
import FilterBar from '../../src/components/FilterBar.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import MoveDialogs from '../../src/components/MoveDialogs.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { TrashBinOffError } from '../../src/api.ts'
import { DEFAULT_FILTERS } from '../../src/logic/picture-filter.ts'
import { mountApp, openCull, shownNames, stored } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { allMoved } from './move-fixtures.ts'

type Move = (request: MoveRequestFile[][]) => Promise<unknown>

/** The app on the cull with the stored settings, its probe finding `/Out` empty and its move endpoint answering `move`. */
async function openApp(decisions: StoredDecision[] = [], move: Move = allMoved(), probeTargets = async (folders: readonly string[]): Promise<TargetFolder[]> => folders.map((path) => ({ path, children: [] })), settings: object = {}) {
	const sent: MoveRequestFile[][][] = []
	const movePictures = async (request: MoveRequestFile[][]) => {
		sent.push(request)
		return move(request)
	}
	const mounted = mountApp({ move: { probeTargets, movePictures }, schedule: fakeScheduler().schedule, loadSettings: async () => settings }, decisions, { NcDialog: DialogStub })
	await openCull(mounted.wrapper)
	return { ...mounted, sent }
}

async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const flowOf = (wrapper: AppWrapper): MoveFlow => wrapper.findComponent(MoveDialogs).props('flow')
const opened = (wrapper: AppWrapper) => flowOf(wrapper).pictures.value?.map((picture) => picture.baseName) ?? null
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()

/** Chooses `/Out` and confirms the move. */
async function moveToOut(wrapper: AppWrapper) {
	flowOf(wrapper).choose('/Out')
	await flushPromises()
	await flowOf(wrapper).confirm()
	await flushPromises()
}

enableAutoUnmount(afterEach)

describe('App: opening the move dialog', () => {
	// spec: MOVE-004.1
	it('opens on the focused tile by M, on the selection by Move…, and on the loupe\'s photo, holding the cull keys', async () => {
		const { wrapper, saved } = await openApp()
		await press('m')
		expect(opened(wrapper)).toEqual(['IMG_2'])
		await press('p')
		expect(saved).toEqual([])
		flowOf(wrapper).close()
		await flushPromises()

		const toolbar = wrapper.findComponent(GridToolbar)
		toolbar.vm.$emit('update:selecting', true)
		toolbar.vm.$emit('selectAll')
		await flushPromises()
		await wrapper.findComponent(ActionBar).findAll('button').find((each) => each.text() === 'Move…')!.trigger('click')
		expect(opened(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		flowOf(wrapper).close()
		await flushPromises()

		wrapper.findComponent(PhotoGrid).vm.$emit('open', 1)
		await flushPromises()
		wrapper.findComponent(PhotoLoupe).vm.$emit('move')
		await flushPromises()
		expect(opened(wrapper)).toEqual(['IMG_9'])
		expect(wrapper.findComponent(MoveDialogs).props('container')).toBe('.photo-loupe')
	})

	// spec: MOVE-004.2
	it('opens on the picks from the More menu, and on the view while a filter is on', async () => {
		const { wrapper } = await openApp([stored(1, 'picked'), stored(4, 'picked')])
		const toolbar = wrapper.findComponent(GridToolbar)
		expect(toolbar.props('movable')).toBe(2)
		toolbar.vm.$emit('move')
		await flushPromises()
		expect(opened(wrapper)).toEqual(['IMG_2', 'IMG_9'])
		flowOf(wrapper).close()

		toolbar.vm.$emit('update:filtersOpen', true)
		await flushPromises()
		wrapper.findComponent(FilterBar).vm.$emit('update:filters', { ...DEFAULT_FILTERS, folders: new Set(['/Trip/A']) })
		await flushPromises()
		expect(toolbar.props('movable')).toBe(2)
		toolbar.vm.$emit('move')
		await flushPromises()
		expect(opened(wrapper)).toEqual(['IMG_9', 'IMG_10'])
	})
})

describe('App: the name template', () => {
	// spec: SETTINGS-001.21
	it('names the moved files by the template in the settings', async () => {
		const { wrapper, sent } = await openApp([], allMoved(), undefined, { moveTemplate: 'Kept/{name:lower}.{ext}' })
		await press('m')
		await moveToOut(wrapper)

		expect(flowOf(wrapper).templateText.value).toBe('Kept/{name:lower}.{ext}')
		expect(sent[0]!.flat().map((file) => file.path)).toEqual(['/Out/Kept/img_2.JPG'])
	})
})

describe('App: the move', () => {
	// spec: MOVE-004.9, MOVE-004.11
	it('takes the moved pictures out of the grid, and Ctrl+Z undoes the latest decision instead', async () => {
		const { wrapper, sent, saved } = await openApp()
		await press('p')
		await press('m')
		expect(opened(wrapper)).toEqual(['IMG_2'])
		await moveToOut(wrapper)

		expect(sent).toHaveLength(1)
		expect(shownNames(wrapper)).toEqual(['IMG_9', 'IMG_10'])
		expect(toastText(wrapper)).toContain('Moved IMG_2 to Out')

		await press('z', { ctrlKey: true })
		expect(saved.at(-1)).toEqual([stored(1, 'unflagged')])
		expect(shownNames(wrapper)).toEqual(['IMG_9', 'IMG_10'])
	})

	// spec: MOVE-004.11
	it('moves the pictures back by Undo in its toast', async () => {
		const { wrapper, sent } = await openApp()
		await press('m')
		await moveToOut(wrapper)
		await wrapper.findComponent(UndoToast).findAll('button').find((each) => each.text() === 'Undo')!.trigger('click')
		await flushPromises()

		expect(sent).toHaveLength(2)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		expect(toastText(wrapper)).toContain('Moved 1 file back')
	})

	// spec: MOVE-004.13
	it('changes nothing when the trash bin is off, and says so', async () => {
		const { wrapper } = await openApp([], async () => {
			throw new TrashBinOffError()
		})
		await press('m')
		await moveToOut(wrapper)

		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
		expect(opened(wrapper)).toBeNull()
		expect(toastText(wrapper)).toContain('The Nextcloud trash bin is off')
	})
})
