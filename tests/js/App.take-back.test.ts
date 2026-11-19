// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import GridToolbar from '../../src/components/GridToolbar.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { logger } from '../../src/logger.ts'
import { decidedFlags, decidedRows, mountApp, openCull, stored } from './app-cull.ts'

enableAutoUnmount(afterEach)

/** Presses a key on the page. */
async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const toast = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast)

describe('App: Clear picks/rejects', () => {
	// spec: GRID-001.22
	it('resets the flagged pictures, says so with Undo, and undoes them as one step', async () => {
		const { wrapper, sidecarSaves } = mountApp({}, [stored(1, 'picked'), stored(4, 'rejected')])
		await openCull(wrapper)

		wrapper.findComponent(GridToolbar).vm.$emit('clearFlags')
		await flushPromises()

		expect(decidedFlags(wrapper)).toEqual([])
		expect(toast(wrapper).props('toast').message).toBe('2 photos reset')
		expect(sidecarSaves).toEqual([])
		toast(wrapper).vm.$emit('act')
		await flushPromises()
		expect(decidedFlags(wrapper)).toEqual(['1 picked', '4 rejected'])
	})
})

describe('App: a failed write is taken back', () => {
	// spec: XMP-008.17, APP-001.13
	it('shows the earlier flag again and says the flag was not saved', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = mountApp({ flags: { save: async () => Promise.reject(new Error('500')), takeOver: async () => ({ saved: [], skipped: [] }) } })
		await openCull(wrapper)

		await press('ArrowRight')
		await press('p')

		expect(decidedFlags(wrapper)).toEqual([])
		expect(toast(wrapper).props('toast').message).toBe('Could not save the flag of 1 photo; it is back as it was')
		expect(toast(wrapper).props('toast').kind).toBe('error')
		expect(error).toHaveBeenCalledOnce()
		error.mockRestore()
	})

	// spec: XMP-008.15, APP-001.13
	it('gives back the rating of the picture whose sidecar is locked and names the reason', async () => {
		const { wrapper } = mountApp({ sidecars: {
			lookupSidecars: async (ids: readonly number[]) => ids.map(() => ({ result: 'notFound' })),
			lookupXmpCache: async () => [],
			saveXmpCache: async () => undefined,
			lookupEmbeddedXmp: async (ids: readonly number[]) => ids.map(() => ({ result: 'none' })),
			saveSidecars: async (items: readonly SidecarSaveItem[]) => items.map((item, index) => ('path' in item && item.path.includes('IMG_2') ? { result: 'locked' } : { result: 'saved', fileId: 100 + index, etag: 'e', size: 1, mtime: 1 })),
			now: () => ({ epochMs: 0, offsetMinutes: 0 }),
		} })
		await openCull(wrapper)

		await press('a', { ctrlKey: true })
		await press('3')

		expect(decidedRows(wrapper).map(({ fileId, rating }) => [fileId, rating])).toEqual([[2, 3], [3, 3], [4, 3]])
		expect(toast(wrapper).props('toast').message).toMatch(/^Could not write 1 sidecar\./)
		expect(toast(wrapper).props('toast').kind).toBe('error')
		expect(toast(wrapper).text()).toContain('The sidecar is locked (another process is writing to it)')
	})
})
