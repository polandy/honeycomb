// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LegacyExport, LegacyInventory } from '../../src/logic/legacy.ts'
import type { SidecarWrite } from '../../src/logic/settings.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { mountApp, openCull } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'

enableAutoUnmount(afterEach)

const INVENTORY: LegacyInventory = { folders: [{ path: '/Photos/A', files: 2 }, { path: '/Photos/B', files: 1 }], unreachable: 3 }
const EXPORTED: LegacyExport = { decisions: [{ fileId: 7, rating: 1, colourLabel: null, flag: 'picked', keepRaw: false }], tags: [{ fileId: 8, tags: ['Anna'] }, { fileId: 9, tags: ['Ben'] }] }

/** The app on a cull, over legacy endpoints answering `inventory`, with writing set as given. */
async function openWith(inventory: LegacyInventory, sidecarWrite: SidecarWrite = 'on') {
	const reads: number[] = []
	const acknowledged: number[][] = []
	const saved: { name: string, text: string }[] = []
	const legacy = {
		loadInventory: async () => {
			reads.push(1)
			return inventory
		},
		loadExport: async () => EXPORTED,
		acknowledge: async (fileIds: readonly number[]) => void acknowledged.push([...fileIds]),
	}
	const saveFile = (name: string, text: string) => void saved.push({ name, text })
	const mounted = mountApp({ legacy, saveFile, loadSettings: async () => ({ sidecarWrite }) }, [], { NcDialog: DialogStub })
	await flushPromises()
	await openCull(mounted.wrapper)
	return { ...mounted, reads, acknowledged, saved }
}

const notice = (wrapper: AppWrapper) => wrapper.find('.legacy-notice')
const button = (wrapper: AppWrapper, text: string) => wrapper.findAll('button').find((each) => each.text() === text)!
const discardDialog = (wrapper: AppWrapper) => wrapper.find('[role="dialog"][name="Discard the stored decisions of missing files"]')

describe('App: the notice of legacy rows', () => {
	// spec: XMP-007.8
	it('names the folders and the missing files, exports and discards on confirm', async () => {
		const { wrapper, reads, acknowledged, saved } = await openWith(INVENTORY)

		expect(notice(wrapper).text()).toContain('honeycomb still stores decisions and tags of 3 photos in its database. Open each folder and choose Write decisions to sidecars… in the ⋯ menu: /Photos/A (2), /Photos/B (1)')
		expect(notice(wrapper).text()).toContain('3 files with stored decisions are gone or no longer shared with you.')

		await button(wrapper, 'Export').trigger('click')
		await flushPromises()
		expect(saved.map(({ name }) => name)).toEqual(['honeycomb-legacy-rows.json'])
		expect(JSON.parse(saved[0]!.text)).toEqual(EXPORTED)

		await button(wrapper, 'Discard').trigger('click')
		await flushPromises()
		await button(wrapper, 'Cancel').trigger('click')
		await flushPromises()
		expect(discardDialog(wrapper).exists()).toBe(false)
		expect(acknowledged).toEqual([])

		await button(wrapper, 'Discard').trigger('click')
		await flushPromises()
		expect(discardDialog(wrapper).text()).toContain('Export them first to keep them')
		await button(wrapper, 'Discard stored decisions').trigger('click')
		await flushPromises()
		expect(acknowledged).toEqual([[7, 8, 9]])
		expect(reads).toEqual([1, 1, 1])
	})

	// spec: XMP-007.8
	it('offers no export without missing files', async () => {
		const { wrapper } = await openWith({ folders: INVENTORY.folders, unreachable: 0 })

		expect(notice(wrapper).exists()).toBe(true)
		expect(wrapper.findAll('button').some((each) => each.text() === 'Export')).toBe(false)
	})

	// spec: XMP-007.8
	it.each<[string, LegacyInventory, SidecarWrite]>([
		['without rows', { folders: [], unreachable: 0 }, 'on'],
		['with writing Off', INVENTORY, 'off'],
	])('shows no notice %s', async (_case, inventory, sidecarWrite) => {
		const { wrapper } = await openWith(inventory, sidecarWrite)

		expect(notice(wrapper).exists()).toBe(false)
	})
})
