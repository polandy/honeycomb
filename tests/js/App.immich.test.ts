// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichCullApi } from '../../src/immich/immich-picture-source.ts'
import type { ImmichApi } from '../../src/immich/immich-source.ts'
import type { DecisionRow } from '../../src/logic/immich-asset.ts'
import type { ConnectionStatus, ImmichAvailability } from '../../src/logic/immich-connections.ts'
import type { AssetsRequest } from '../../src/logic/immich-paging.ts'
import type { ViewStatePatch } from '../../src/logic/view-state.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppNavigation from '../../src/components/AppNavigation.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import ImmichConnectionDialog from '../../src/components/ImmichConnectionDialog.vue'
import ImmichScreen from '../../src/components/ImmichScreen.vue'
import ImmichState from '../../src/components/ImmichState.vue'
import { IMMICH_CONNECTION_KEY } from '../../src/immich/immich-source.ts'
import { logger } from '../../src/shared/logger.ts'
import { fakeStorage, mountApp, openCull, shownNames, SILENT_IMMICH_CULL } from './app-cull.ts'
import { immichEntry } from './logic/immich-fixtures.ts'

enableAutoUnmount(afterEach)

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example', picksAsFavorites: false }
const KIDS = { id: 'kids', label: 'Kids', url: 'https://immich.example', picksAsFavorites: false }
const OK = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 } as const
const UNREACHABLE: ConnectionStatus = { state: 'unreachable', account: null, version: null, total: null }

/** An Immich server with the given connections that answers each status as `OK` and records what it was asked. */
function immichOn(availability: ImmichAvailability, status: ConnectionStatus = OK) {
	const asked: string[] = []
	const api: ImmichApi = { listConnections: async () => availability, status: async (id) => (asked.push(id), status) }
	return { immich: api, asked }
}

describe('App: the Immich source', () => {
	// spec: IMMICH-001.1
	it('offers no Immich when it is not configured', async () => {
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'none' }).immich })
		await flushPromises()

		expect(wrapper.findComponent(AppNavigation).props('offersImmich')).toBe(false)
	})

	// spec: IMMICH-001.20
	it('closes the folder picker before a first cull, with Immich offered or not', async () => {
		const offered = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }).immich }).wrapper
		const none = mountApp({ immich: immichOn({ kind: 'none' }).immich }).wrapper
		await flushPromises()
		for (const wrapper of [offered, none]) {
			wrapper.findComponent(AppNavigation).vm.$emit('chooseFolders')
			await flushPromises()
			wrapper.findComponent(FolderPicker).vm.$emit('cancel')
			await flushPromises()

			expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		}
	})

	// spec: IMMICH-001.15
	it('opens Immich beside the folder cull and comes back to it unchanged', async () => {
		const { immich, asked } = immichOn({ kind: 'connections', connections: [PHONE] })
		const { wrapper } = mountApp({ immich })
		await openCull(wrapper)
		const navigation = () => wrapper.findComponent(AppNavigation)
		expect(navigation().props('offersImmich')).toBe(true)

		navigation().vm.$emit('chooseSource', 'immich')
		await flushPromises()
		expect(wrapper.findComponent(GridToolbar).exists()).toBe(false)
		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(true)
		expect(asked).toEqual(['andy-phone', 'andy-phone'])

		navigation().vm.$emit('chooseSource', 'nextcloud')
		await flushPromises()
		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(false)
		expect(shownNames(wrapper)).toEqual(['IMG_2', 'IMG_9', 'IMG_10'])
	})

	// spec: IMMICH-001.14
	it('opens the chosen connection and opens it again after a reload', async () => {
		const stored: Record<string, string> = {}
		const { immich } = immichOn({ kind: 'connections', connections: [PHONE, KIDS] })
		const { wrapper } = mountApp({ immich, storage: fakeStorage(stored) })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		wrapper.findComponent(AppNavigation).vm.$emit('openConnection', 'kids')
		await flushPromises()
		expect(wrapper.findComponent(AppNavigation).props('connections')).toEqual([
			{ id: 'andy-phone', label: 'Andy · Phone', line: 'Connected as andy', working: true },
			{ id: 'kids', label: 'Kids', line: 'Connected as andy', working: true },
		])
		expect(wrapper.findComponent(ImmichScreen).props('cull').connectionId.value).toBe('kids')
		wrapper.unmount()

		const reloaded = mountApp({ immich, storage: fakeStorage(stored) }).wrapper
		await flushPromises()

		expect(stored[IMMICH_CONNECTION_KEY]).toBe('kids')
		expect(reloaded.findComponent(AppNavigation).props('connectionId')).toBe('kids')
	})

	// spec: IMMICH-001.13
	it('opens the connection dialog from the navigation and tests the connection again', async () => {
		const { immich, asked } = immichOn({ kind: 'connections', connections: [PHONE] })
		const { wrapper } = mountApp({ immich })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()
		expect(wrapper.findComponent(ImmichConnectionDialog).exists()).toBe(false)

		wrapper.findComponent(AppNavigation).vm.$emit('connectionDetails')
		await flushPromises()
		const dialog = wrapper.findComponent(ImmichConnectionDialog)
		expect(dialog.props()).toEqual({ connection: PHONE, status: OK })
		dialog.vm.$emit('test')
		await flushPromises()
		expect(asked).toEqual(['andy-phone', 'andy-phone', 'andy-phone'])

		dialog.vm.$emit('close')
		await flushPromises()
		expect(wrapper.findComponent(ImmichConnectionDialog).exists()).toBe(false)
	})

	// spec: IMMICH-001.19
	it('tries a connection again from its state', async () => {
		const { immich, asked } = immichOn({ kind: 'connections', connections: [PHONE] }, UNREACHABLE)
		const { wrapper } = mountApp({ immich })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()

		wrapper.findComponent(ImmichState).vm.$emit('retry')
		wrapper.findComponent(ImmichState).vm.$emit('details')
		await flushPromises()

		expect(asked).toEqual(['andy-phone', 'andy-phone', 'andy-phone'])
		expect(wrapper.findComponent(ImmichConnectionDialog).exists()).toBe(true)
	})

	// spec: IMMICH-002.6, IMMICH-002.13
	it('shows the connection\'s pictures once its status is ok, and asks their first page and counts', async () => {
		const asked: string[] = []
		const immichCull: ImmichCullApi = { ...SILENT_IMMICH_CULL, assets: (id) => (asked.push(`assets ${id}`), new Promise(() => undefined)), counts: (id) => (asked.push(`counts ${id}`), new Promise(() => undefined)) }
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }).immich, immichCull })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()

		expect(wrapper.findComponent(ImmichState).exists()).toBe(false)
		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(true)
		expect(asked.toSorted()).toEqual(['assets andy-phone', 'counts andy-phone'])
	})

	// spec: IMMICH-001.19
	it('shows the connection\'s state instead of its pictures while it fails', async () => {
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }, UNREACHABLE).immich })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()

		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(false)
		expect(wrapper.findComponent(ImmichState).props('status')).toEqual(UNREACHABLE)
	})

	// spec: IMMICH-003.19
	it('undoes and redoes the Immich decisions with Ctrl+Z and Ctrl+Shift+Z', async () => {
		const saved: DecisionRow[][] = []
		const immichCull: ImmichCullApi = { ...SILENT_IMMICH_CULL, assets: async () => ({ entries: [immichEntry('a1')], nextCursor: null, previousCursor: null }), saveDecisions: async (_id, rows) => (saved.push([...rows]), rows.map(({ assetId }) => assetId)) }
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }).immich, immichCull })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()
		const cull = wrapper.findComponent(ImmichScreen).props('cull')
		cull.decide({ kind: 'flag', flag: 'picked' }, cull.pictures.value)
		await flushPromises()

		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }))
		await flushPromises()
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Z', ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true }))
		await flushPromises()

		expect(saved.map((rows) => rows.map(({ flag }) => flag))).toEqual([['picked'], ['unflagged'], ['picked']])
	})
	// spec: IMMICH-004.25
	it('opens *Write to Immich* from the Immich toolbar and checks the opened connection\'s candidates', async () => {
		const asked: string[] = []
		const immichWrite = { candidates: async (id: string) => (asked.push(id), []), check: async () => [], write: async () => [], imageUrl: () => '' }
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }).immich, immichWrite })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()

		await wrapper.find('.immich-screen__write').trigger('click')
		await flushPromises()

		expect(asked).toEqual([PHONE.id])
		expect(wrapper.findComponent(ImmichScreen).props('write')?.step.value).toEqual({ kind: 'ready' })
	})

	// spec: IMMICH-002.32, LOUPE-003.10
	it('opens each connection on its filters from the view state and writes a change for that connection only', async () => {
		const requests: [string, AssetsRequest][] = []
		const writes: ViewStatePatch[] = []
		const immichCull: ImmichCullApi = { ...SILENT_IMMICH_CULL, assets: (id, request) => (requests.push([id, request]), new Promise(() => undefined)) }
		const viewState = { loadViewState: async () => ({ gesture_guide_seen: true, immich_filters: { 'andy-phone': { time: 'all', kinds: ['video'] } } }), saveViewState: async (patch: ViewStatePatch) => void writes.push(patch) }
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE, KIDS] }).immich, immichCull, viewState })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()
		expect(requests.at(-1)).toEqual(['andy-phone', expect.objectContaining({ filters: expect.objectContaining({ takenAfter: null, kinds: ['video'] }) })])

		const cull = wrapper.findComponent(ImmichScreen).props('cull')
		cull.setFilters({ ...cull.filters.value, kinds: new Set(['photo']) })
		expect(writes).toEqual([{ immich_filters: { 'andy-phone': expect.objectContaining({ time: 'all', kinds: ['photo'] }) } }])

		wrapper.findComponent(AppNavigation).vm.$emit('openConnection', 'kids')
		await flushPromises()
		expect(requests.at(-1)).toEqual(['kids', expect.objectContaining({ filters: expect.objectContaining({ kinds: [] }) })])
		wrapper.findComponent(AppNavigation).vm.$emit('openConnection', 'andy-phone')
		await flushPromises()
		expect(requests.at(-1)).toEqual(['andy-phone', expect.objectContaining({ filters: expect.objectContaining({ takenAfter: null, kinds: ['photo'] }) })])
	})

	// spec: IMMICH-002.32
	it('opens on the default filters when the view state cannot be read', async () => {
		const error = vi.spyOn(logger, 'error').mockReturnValue()
		const requests: AssetsRequest[] = []
		const immichCull: ImmichCullApi = { ...SILENT_IMMICH_CULL, assets: (_id, request) => (requests.push(request), new Promise(() => undefined)) }
		const viewState = { loadViewState: () => Promise.reject(new Error('offline')), saveViewState: async () => undefined }
		const { wrapper } = mountApp({ immich: immichOn({ kind: 'connections', connections: [PHONE] }).immich, immichCull, viewState })
		await flushPromises()
		wrapper.findComponent(AppNavigation).vm.$emit('chooseSource', 'immich')
		await flushPromises()

		expect(requests).toHaveLength(1)
		expect(requests[0]!.filters.kinds).toEqual([])
		expect(error).toHaveBeenCalledWith('Could not read the stored Immich filters; the defaults apply.', expect.anything())
		error.mockRestore()
	})
})
