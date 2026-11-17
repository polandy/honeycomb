// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { LegacyExport, LegacyInventory } from '../../src/logic/legacy.ts'
import type { SidecarWrite } from '../../src/logic/settings.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UndoToast from '../../src/components/UndoToast.vue'
import { ENTRIES, mountApp, openCull, toolbarProps } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'

enableAutoUnmount(afterEach)

const INVENTORY: LegacyInventory = { folders: [{ path: '/Photos/A', files: 2 }, { path: '/Photos/B', files: 1 }], unreachable: 3 }
const EXPORTED: LegacyExport = { decisions: [{ fileId: 7, rating: 1, colourLabel: null, flag: 'picked', keepRaw: false }], tags: [{ fileId: 8, tags: ['Anna'] }, { fileId: 9, tags: ['Ben'] }] }

/** The app on a cull, over legacy endpoints answering `inventory`, with writing set as given. */
async function openWith(inventory: LegacyInventory, sidecarWrite: SidecarWrite = 'on') {
	const reads: number[] = []
	const listed: string[] = []
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
	const listEntries = async (path: string, subfolders: boolean) => {
		listed.push(`${path}${subfolders ? ' +' : ''}`)
		return { entries: path === '/Photos/B' ? ENTRIES : [], truncated: false, folders: [], opened: null }
	}
	const mounted = mountApp({ legacy, saveFile, listEntries, loadSettings: async () => ({ sidecarWrite }) }, [], { NcDialog: DialogStub })
	await flushPromises()
	await openCull(mounted.wrapper)
	return { ...mounted, reads, listed, acknowledged, saved }
}

const notice = (wrapper: AppWrapper) => wrapper.find('.legacy-notice')
const button = (wrapper: AppWrapper, text: string) => wrapper.findAll('button').find((each) => each.text() === text)!
const forgetDialog = (wrapper: AppWrapper) => wrapper.find('[role="dialog"][name="Forget the decisions of missing files"]')

describe('App: the notice of legacy rows', () => {
	// spec: XMP-007.8
	it('says what to do and why, names the missing files, saves a copy and forgets on confirm', async () => {
		const { wrapper, reads, acknowledged, saved } = await openWith(INVENTORY)

		expect(notice(wrapper).text()).toContain('Move the decisions of 3 photos into their sidecars')
		expect(notice(wrapper).text()).toContain('honeycomb keeps them in its database, where digiKam, darktable and Lightroom cannot see them. Open a folder and choose ⋯ → Write decisions to sidecars…')
		expect(notice(wrapper).findAll('.legacy-notice__folders button').map((each) => each.text())).toEqual(['/Photos/A (2)', '/Photos/B (1)'])
		expect(notice(wrapper).text()).toContain('3 files with stored decisions were deleted or are no longer shared with you, so their sidecars cannot be written. Save a copy of their decisions, or forget them.')

		await button(wrapper, 'Save a copy').trigger('click')
		await flushPromises()
		expect(saved.map(({ name }) => name)).toEqual(['honeycomb-legacy-rows.json'])
		expect(JSON.parse(saved[0]!.text)).toEqual(EXPORTED)
		expect(wrapper.findComponent(UndoToast).text()).toBe('Saved a copy as honeycomb-legacy-rows.json')

		await button(wrapper, 'Forget…').trigger('click')
		await flushPromises()
		await button(wrapper, 'Cancel').trigger('click')
		await flushPromises()
		expect(forgetDialog(wrapper).exists()).toBe(false)
		expect(acknowledged).toEqual([])

		await button(wrapper, 'Forget…').trigger('click')
		await flushPromises()
		expect(forgetDialog(wrapper).text()).toContain('honeycomb removes the stored decisions and tags of 3 files from its database for good. Save a copy first to keep them.')
		await button(wrapper, 'Forget').trigger('click')
		await flushPromises()
		expect(acknowledged).toEqual([[7, 8, 9]])
		expect(wrapper.findComponent(UndoToast).text()).toBe('Forgot the stored decisions of 3 files')
		expect(reads).toEqual([1, 1, 1])
	})

	// spec: XMP-007.10
	it('opens a folder of the notice alone', async () => {
		const { wrapper, listed } = await openWith(INVENTORY)

		await button(wrapper, '/Photos/B (1)').trigger('click')
		await flushPromises()

		expect(listed).toEqual(['/Photos/B'])
		expect(toolbarProps(wrapper).folderSet).toEqual({ paths: ['/Photos/B'], subfolders: false })
	})

	// spec: XMP-007.8
	it('names no folders when only missing files are left', async () => {
		const { wrapper } = await openWith({ folders: [], unreachable: 1 })

		expect(notice(wrapper).text()).not.toContain('Move the decisions')
		expect(notice(wrapper).text()).toContain('1 file with stored decisions was deleted or is no longer shared with you, so its sidecar cannot be written. Save a copy of its decisions, or forget them.')
	})

	// spec: XMP-007.8
	it('offers no copy without missing files', async () => {
		const { wrapper } = await openWith({ folders: INVENTORY.folders, unreachable: 0 })

		expect(notice(wrapper).exists()).toBe(true)
		expect(wrapper.findAll('button').some((each) => each.text() === 'Save a copy')).toBe(false)
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
