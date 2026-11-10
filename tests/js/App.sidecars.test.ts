// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { ENTRIES, mountApp, openCull, SET, stored } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { listingEntry } from './logic/listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, packetOf } from './logic/xmp/xmp-builders.ts'

enableAutoUnmount(afterEach)

const WITH_SIDECARS = [...ENTRIES, listingEntry(5, '/Trip/A/IMG_9.JPG.xmp'), listingEntry(6, '/Trip/A/IMG_10.CR3.xmp')]
const GOOD = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)

/** The app on a cull whose folder A is shared, IMG_10 and IMG_9 decided; the sidecar endpoints answer as told. */
async function openShared(lookup: (fileId: number) => SidecarLookupAnswer, save: (item: SidecarSaveItem) => SidecarSaveAnswer) {
	const lookups: number[][] = []
	const saves: SidecarSaveItem[][] = []
	const sidecars = {
		lookupSidecars: async (fileIds: readonly number[]) => {
			lookups.push([...fileIds])
			return fileIds.map(lookup)
		},
		saveSidecars: async (items: readonly SidecarSaveItem[]) => {
			saves.push([...items])
			return items.map(save)
		},
		now: () => CANONICAL_TIME,
	}
	const mounted = mountApp({ sidecars, schedule: fakeScheduler().schedule }, [stored(2, 'picked'), stored(4, 'rejected')], { NcDialog: DialogStub })
	await openCull(mounted.wrapper, SET, WITH_SIDECARS, ['/Trip/A'])
	return { ...mounted, lookups, saves }
}

const read = (bytes: Uint8Array): SidecarLookupAnswer => ({ result: 'read', bytes, etag: 'e', size: bytes.length, mtime: 1 })
const saved = (): SidecarSaveAnswer => ({ result: 'saved', fileId: 50, etag: 's', size: 1, mtime: 2 })
const dialog = (wrapper: AppWrapper, name: string) => wrapper.find(`[role="dialog"][name="${name}"]`)
const button = (wrapper: AppWrapper, text: string) => wrapper.findAll('button').find((each) => each.text() === text)!
const toastText = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).text()

/** Opens *Write decisions to sidecars…* from the More menu. */
async function askToWrite(wrapper: AppWrapper) {
	wrapper.findComponent(GridToolbar).vm.$emit('writeSidecars')
	await flushPromises()
}

describe('App: writing decisions to sidecars in a shared folder', () => {
	// spec: XMP-003.11, XMP-003.12
	it('writes nothing on its own, asks first and writes the decided photos on confirm', async () => {
		const { wrapper, saves } = await openShared(() => read(GOOD), saved)
		expect(wrapper.findComponent(GridToolbar).props('sidecarsShared')).toBe(true)
		expect(saves).toEqual([])

		await askToWrite(wrapper)
		const asked = dialog(wrapper, 'Write decisions to sidecars')
		expect(asked.text()).toContain('This folder is shared. honeycomb keeps your decisions to yourself and writes nothing next to the files on its own.')
		expect(asked.text()).toContain('Every user of this folder, and digiKam, darktable and Lightroom, will see these decisions.')
		expect(asked.text()).toContain('The XMP sidecar of each file gets its rating, colour label and flag. 2 photos in A')
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()

		expect(dialog(wrapper, 'Write decisions to sidecars').exists()).toBe(false)
		expect(saves.flat().map((item) => ('path' in item ? item.path : item.fileId))).toEqual([6, '/Trip/A/IMG_10.JPG.xmp', 5])
		expect(toastText(wrapper)).toBe('Wrote the decisions of 2 photos to sidecars')
	})

	// spec: XMP-003.12
	it('writes nothing on Cancel, and offers nothing without a shared folder', async () => {
		const { wrapper, saves } = await openShared(() => read(GOOD), saved)

		await askToWrite(wrapper)
		await button(wrapper, 'Cancel').trigger('click')
		await flushPromises()
		expect(dialog(wrapper, 'Write decisions to sidecars').exists()).toBe(false)
		expect(saves).toEqual([])

		await openCull(wrapper, SET, WITH_SIDECARS, [])
		expect(wrapper.findComponent(GridToolbar).props('sidecarsShared')).toBe(false)
	})

	// spec: XMP-003.13
	it('reports each failed sidecar and retries their photos', async () => {
		const { wrapper, saves, lookups } = await openShared(
			(fileId) => read(fileId === 5 ? fixtureBytes('refused/unclosed.xmp') : GOOD),
			(item) => ('path' in item ? { result: 'notPermitted' } : saved()),
		)

		await askToWrite(wrapper)
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		expect(saves.flat().map((item) => ('path' in item ? item.path : item.fileId))).toEqual([6, '/Trip/A/IMG_10.JPG.xmp'])
		expect(toastText(wrapper)).toBe('Could not write 2 sidecars·Details')

		await wrapper.findComponent(UndoToast).find('button').trigger('click')
		const report = dialog(wrapper, 'Some sidecars could not be written')
		expect(report.text()).toContain('A/IMG_9.JPG.xmp')
		expect(report.text()).toContain('The sidecar is not well-formed XML; honeycomb leaves it as it is')
		expect(report.text()).toContain('A/IMG_10.JPG.xmp')
		expect(report.text()).toContain('You may not change this sidecar or create files in its folder')

		await button(wrapper, 'Retry failed sidecars').trigger('click')
		await flushPromises()
		expect(lookups.at(-1)).toEqual([5])
		expect(saves.at(-1)!.map((item) => ('path' in item ? item.path : item.fileId))).toEqual(['/Trip/A/IMG_10.JPG.xmp'])
		expect(dialog(wrapper, 'Some sidecars could not be written').exists()).toBe(false)
	})
})
