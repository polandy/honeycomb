// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import type { Folder } from '../../../src/api/index.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderPicker from '../../../src/components/FolderPicker.vue'
import { DialogStub } from './stubs.ts'

const folder = (name: string): Folder => ({ name, path: `/${name}`, hasSubfolders: false, pictures: 0, picturesBelow: 0, picturesBelowApproximate: false, orphanedSidecars: 0, orphanedSidecarsBelow: 0 })

async function mountPicker(roots: string[]) {
	const wrapper = mount(FolderPicker, {
		props: { current: null, listFolders: async () => [folder('Photos'), folder('Docs')], listEntries: async () => ({ entries: [], truncated: false }), roots },
		global: { stubs: { NcDialog: DialogStub } },
	})
	await flushPromises()
	return (name: string) => wrapper.findAll('[role="treeitem"]').find((row) => row.text().includes(name))!
}

describe('FolderPicker library roots', () => {
	// spec: SETTINGS-001.36
	it('disables a folder outside the library roots and says why', async () => {
		const row = await mountPicker(['/Photos'])

		expect(row('Docs').attributes('aria-disabled')).toBe('true')
		expect(row('Docs').text()).toContain('Outside your library roots')
		expect(row('Photos').attributes('aria-disabled')).toBeUndefined()
		expect(row('Photos').text()).not.toContain('Outside your library roots')
	})

	// spec: SETTINGS-001.36
	it('offers every folder while no root is set', async () => {
		const row = await mountPicker([])

		expect(row('Docs').attributes('aria-disabled')).toBeUndefined()
		expect(row('Docs').text()).not.toContain('Outside your library roots')
	})
})
