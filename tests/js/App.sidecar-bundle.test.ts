// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { ENTRIES, mountApp, openCull, SET } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'
import { listingEntry } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from './logic/xmp/xmp-builders.ts'

const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)

/** The app with writing on and the loupe open on IMG_9, its sidecar endpoints recorded. */
async function openLoupe() {
	const saves: SidecarSaveItem[][] = []
	const sidecars = {
		lookupSidecars: async (fileIds: readonly number[]) => fileIds.map(() => ({ result: 'read' as const, bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupEmbeddedXmp: async (fileIds: readonly number[]) => fileIds.map(() => ({ result: 'none' as const })),
		saveSidecars: async (items: readonly SidecarSaveItem[]) => {
			saves.push([...items])
			return items.map(() => ({ result: 'saved' as const, fileId: 50, etag: 's', size: 1, mtime: 2 }))
		},
		now: () => CANONICAL_TIME,
	}
	const mounted = mountApp({ sidecars, loadSettings: async () => ({ sidecarWrite: 'on' }), schedule: fakeScheduler().schedule }, [], { NcDialog: DialogStub, PhotoLoupe: false })
	await flushPromises()
	await openCull(mounted.wrapper, SET, [...ENTRIES, listingEntry(5, '/Trip/A/IMG_9.JPG.xmp')])
	mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', 1)
	await flushPromises()
	return { ...mounted, saves }
}

async function press(key: string) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
	await flushPromises()
}

const unsaved = (wrapper: AppWrapper) => wrapper.findComponent(PhotoGrid).props('unsaved')?.baseName ?? null

enableAutoUnmount(afterEach)

describe('App: sidecar writes bundled per picture', () => {
	// spec: XMP-003.25, XMP-003.28
	it('marks the shown picture not saved yet and writes its steps together once the loupe shows the next', async () => {
		const { wrapper, saves } = await openLoupe()

		await press('3')
		await press('4')
		expect(saves).toEqual([])
		expect(unsaved(wrapper)).toBe('IMG_9')

		await press('ArrowRight')
		expect(saves).toHaveLength(1)
		expect(unsaved(wrapper)).toBeNull()
	})
})
