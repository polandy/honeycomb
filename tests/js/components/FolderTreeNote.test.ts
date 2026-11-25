// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderTree from '../../../src/components/FolderTree.vue'
import { fakeFolders, item } from './folder-tree-fixture.ts'

describe('FolderTree disabled note', () => {
	// spec: SETTINGS-001.35
	it('shows the note of a folder that is refused and does not toggle it', async () => {
		const folders = fakeFolders()
		const disabledNote = (path: string) => (path === '/Day 9' ? 'Already a root' : null)
		const wrapper = mount(FolderTree, { props: { ticked: [], listFolders: folders.listFolders, single: true, disabledNote } })
		await folders.answer('')

		expect(item(wrapper, 'Day 9').attributes('aria-disabled')).toBe('true')
		expect(item(wrapper, 'Day 9').text()).toContain('Already a root')
		expect(item(wrapper, 'Day 10').attributes('aria-disabled')).toBeUndefined()

		await item(wrapper, 'Day 9').trigger('click')
		await item(wrapper, 'Day 10').trigger('click')

		expect(wrapper.emitted('toggle')).toEqual([['/Day 10']])
	})
})
