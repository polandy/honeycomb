// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListedAccess } from '../../src/logic/writability.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UndoToast from '../../src/components/UndoToast.vue'
import { decidedFlags, ENTRIES, mountApp, openCull, SET } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'

enableAutoUnmount(afterEach)

/** `/Trip/A`, which holds IMG_9 and IMG_10, is read-only; `/Trip/B` with IMG_2 may be written. */
const READ_ONLY_A: ListedAccess = { folders: [{ path: '/Trip/A', permissions: 1 }] }

/** Presses a key on the page. */
async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const toast = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast)

describe('App: a step over pictures of which some are locked', () => {
	// spec: XMP-008.14, XMP-008.10, GRID-003.5
	it('decides the writable ones, reports the locked ones with Details, and undoes the partial step as one', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper, SET, ENTRIES, READ_ONLY_A)

		await press('a', { ctrlKey: true })
		await press('x')

		expect(decidedFlags(wrapper)).toEqual(['1 rejected'])
		expect(toast(wrapper).props('toast').message).toBe('Rejected IMG_2; 2 photos not changed: read only')
		expect(toast(wrapper).props('toast').kind).toBeUndefined()

		toast(wrapper).vm.$emit('act')
		await flushPromises()
		expect(decidedFlags(wrapper)).toEqual([])
		expect(toast(wrapper).props('toast').message).toBe('Undid: Rejected IMG_2')
	})

	// spec: XMP-008.14, APP-001.14
	it('opens the locked pictures in a dialog from Details, which closes the toast', async () => {
		const { wrapper } = mountApp({}, [], { NcDialog: DialogStub })
		await openCull(wrapper, SET, ENTRIES, READ_ONLY_A)
		await press('a', { ctrlKey: true })
		await press('x')

		toast(wrapper).vm.$emit('details')
		await flushPromises()

		expect(toast(wrapper).exists()).toBe(false)
		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Rejected IMG_2; 2 photos not changed: read only')
		expect(wrapper.findAll('[role="dialog"] li').map((item) => item.text())).toEqual(['IMG_9: read only', 'IMG_10: read only'])
		await wrapper.find('[role="dialog"] button').trigger('click')
		expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
	})

	// spec: XMP-008.3, APP-001.13
	it('names the reason in a toast when every picture is read only and asks nothing', async () => {
		const { wrapper, sidecarSaves } = mountApp({}, [], { NcDialog: DialogStub })
		await openCull(wrapper, SET, ENTRIES, { folders: [{ path: '/Trip/A', permissions: 1 }, { path: '/Trip/B', permissions: 3 }] })

		await press('a', { ctrlKey: true })
		await press('x')

		expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
		expect(decidedFlags(wrapper)).toEqual([])
		expect(toast(wrapper).props('toast').message).toBe('Not changed: read only')
		expect(toast(wrapper).props('toast').kind).toBe('error')
		expect(sidecarSaves).toEqual([])
	})
})
