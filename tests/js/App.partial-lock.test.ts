// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListedAccess } from '../../src/logic/writability.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import UndoToast from '../../src/components/UndoToast.vue'
import { decidedFlags, ENTRIES, mountApp, openCull, SET } from './app-cull.ts'

enableAutoUnmount(afterEach)

/** `/Trip/A`, which holds IMG_9 and IMG_10, is read-only; `/Trip/B` with IMG_2 may be written. */
const READ_ONLY_A: ListedAccess = { folders: [{ path: '/Trip/A', shared: false, permissions: 1, versions: true }], opened: [{ path: '/Trip', fileId: 7 }] }

/** Presses a key on the page. */
async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

const toast = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast)

describe('App: a step over pictures of which some are locked', () => {
	// spec: XMP-008.9, XMP-008.10, GRID-003.5
	it('decides the writable ones, reports the locked ones with Details, and undoes the partial step as one', async () => {
		const { wrapper } = mountApp()
		await openCull(wrapper, SET, ENTRIES, READ_ONLY_A)

		await press('a', { ctrlKey: true })
		await press('x')

		expect(decidedFlags(wrapper)).toEqual(['1 rejected'])
		expect(toast(wrapper).props('toast').message).toBe('Rejected IMG_2; 2 photos not changed: you may only read the folder')
		expect(toast(wrapper).findAll('li').map((item) => item.text())).toEqual(['IMG_9: you may only read the folder', 'IMG_10: you may only read the folder'])

		toast(wrapper).vm.$emit('act')
		await flushPromises()
		expect(decidedFlags(wrapper)).toEqual([])
		expect(toast(wrapper).props('toast').message).toBe('Undid: Rejected IMG_2')
	})
})
