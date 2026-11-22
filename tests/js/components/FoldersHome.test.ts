// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FoldersHome as Home } from '../../../src/folders-home.ts'

import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowRef } from 'vue'
import FoldersHome from '../../../src/components/FoldersHome.vue'
import FoldersScreen from '../../../src/components/FoldersScreen.vue'
import LibrarySetup from '../../../src/components/LibrarySetup.vue'
import { row } from '../logic/folder-fixtures.ts'

/** A home with the roots, its actions recorded. */
function fakeHome(roots: readonly string[]) {
	return {
		rows: shallowRef([row({ path: '/Photos/Trip' })]),
		state: ref('ready' as const),
		updating: ref(null),
		shown: ref(true),
		fromList: ref(false),
		roots: computed(() => roots),
		refresh: vi.fn(async () => undefined),
		show: vi.fn(async () => undefined),
		leave: vi.fn(),
		check: vi.fn(async () => true),
		cull: vi.fn(),
		hide: vi.fn(),
		back: vi.fn(),
		saveRoots: vi.fn(),
		now: () => 0,
	} satisfies Home
}

function mountHome(home: Home) {
	return mount(FoldersHome, { props: { home, listFolders: async () => [] }, global: { stubs: { LibrarySetup: true, FoldersScreen: true } } })
}

describe('FoldersHome', () => {
	// spec: FOLDERS-007.5
	it('asks for the library without roots and saves the chosen ones', () => {
		const home = fakeHome([])
		const wrapper = mountHome(home)

		expect(wrapper.findComponent(FoldersScreen).exists()).toBe(false)
		wrapper.findComponent(LibrarySetup).vm.$emit('save', ['/Photos'])

		expect(home.saveRoots).toHaveBeenCalledWith(['/Photos'])
	})

	// spec: FOLDERS-007.13
	it('lists the folders of the roots and culls the one chosen', () => {
		const home = fakeHome(['/Photos'])
		const wrapper = mountHome(home)

		expect(wrapper.findComponent(LibrarySetup).exists()).toBe(false)
		expect(wrapper.findComponent(FoldersScreen).props('roots')).toEqual(['/Photos'])
		wrapper.findComponent(FoldersScreen).vm.$emit('cull', { paths: ['/Photos/Trip'], subfolders: false })

		expect(home.cull).toHaveBeenCalledWith({ paths: ['/Photos/Trip'], subfolders: false })
	})
})
