// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { FolderSet } from '../../../src/logic/folder-set.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import GridToolbar from '../../../src/components/GridToolbar.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { PopoverStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

function mountToolbar(folderSet: FolderSet, folders = 1) {
	return mount(GridToolbar, {
		props: { folderSet, folders, tileSize: 150.4, groupByFolder: false },
		global: { stubs: { NcPopover: PopoverStub } },
	})
}

const setName = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.find('.grid-toolbar__set').text().replaceAll(MARK, '')

describe('GridToolbar', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it.each([
		[{ paths: ['/Photos/Trip'], subfolders: false }, 'Trip'],
		[{ paths: ['/Photos/Trip'], subfolders: true }, 'Trip + subfolders'],
		[{ paths: ['/A', '/B'], subfolders: false }, '2 folders'],
		[{ paths: ['/A', '/B'], subfolders: true }, '2 folders + subfolders'],
	])('names the folder set %o "%s"', (folderSet, name) => {
		expect(setName(mountToolbar(folderSet))).toBe(name)
	})

	it('opens the folder picker from Home and from the set name', async () => {
		const wrapper = mountToolbar({ paths: ['/A', '/B'], subfolders: false })

		await wrapper.find(`[aria-label="${MARK}Change folders"]`).trigger('click')
		await wrapper.find('.grid-toolbar__set').trigger('click')

		expect(wrapper.find('.grid-toolbar__set').attributes('aria-label')).toBe(`${MARK}Change folders: /A, /B`)
		expect(wrapper.emitted('changeFolders')).toEqual([[], []])
	})

	it('sets the thumbnail size from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const range = wrapper.find(`input[type="range"][aria-label="${MARK}Thumbnail size"]`)

		expect(wrapper.find(`[aria-label="${MARK}More"]`).exists()).toBe(true)
		expect(range.attributes()).toMatchObject({ min: '90', max: '340' })
		expect((range.element as HTMLInputElement).value).toBe('150')
		await range.setValue('200')

		expect(wrapper.emitted('update:tileSize')).toEqual([[200]])
	})

	it('offers Group by folder only when the cull spans more than one folder', async () => {
		expect(mountToolbar({ paths: ['/A'], subfolders: true }, 1).text()).not.toContain('Group by folder')
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: true }, 2)

		await wrapper.find('input[type="checkbox"]').setValue(true)

		expect(wrapper.text()).toContain(`${MARK}Group by folder`)
		expect(wrapper.emitted('update:groupByFolder')).toEqual([[true]])
	})

	it('renders no text that bypasses the catalogue but the folder name', () => {
		const wrapper = mountToolbar({ paths: ['/Photos/Trip'], subfolders: false }, 2)

		expect(untranslatedText(wrapper.element as Element)).toEqual(['Trip'])
	})
})
