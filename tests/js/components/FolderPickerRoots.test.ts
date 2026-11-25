// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderPicker from '../../../src/components/FolderPicker.vue'
import FolderTree from '../../../src/components/FolderTree.vue'
import { DialogStub } from './stubs.ts'

async function mountPicker(roots: string[]) {
	const wrapper = mount(FolderPicker, {
		props: { current: null, listFolders: async () => [], listEntries: async () => ({ entries: [], truncated: false }), roots },
		global: { stubs: { NcDialog: DialogStub } },
	})
	await flushPromises()
	return (wrapper.findComponent(FolderTree).props('disabledNote') as (path: string) => string | null)
}

describe('FolderPicker library roots', () => {
	// spec: SETTINGS-001.36
	it('offers only folders inside a library root', async () => {
		const note = await mountPicker(['/Photos'])

		expect(note('/Photos/2025')).toBeNull()
		expect(note('/Docs')).toContain('Outside your library roots')
	})

	// spec: SETTINGS-001.36
	it('offers every folder while no root is set', async () => {
		expect((await mountPicker([]))('/Docs')).toBeNull()
	})
})
