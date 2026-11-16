// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { FOLDERS, item, mountTree, twisty } from './folder-tree-fixture.ts'

const MARK = TRANSLATED_MARK
const TREE = {
	...FOLDERS,
	'/Photos/2026': [{ name: 'Raw', path: '/Photos/2026/Raw', hasSubfolders: false, photoFiles: 4, photoFilesBelow: 4 }],
}

describe('FolderTree excluded folders', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: LISTING-003.21
	it('marks an excluded folder with a minus, struck through and "excluded", not selected, and tappable', async () => {
		const { wrapper, answer } = await mountTree(['/Photos'], true, TREE, ['/Photos/2025'])
		await answer('/Photos')
		const excluded = item(wrapper, '2025')

		expect(excluded.find('.folder-tree__box--excluded').exists()).toBe(true)
		expect(excluded.find('.folder-tree__name--excluded').exists()).toBe(true)
		expect(excluded.find('.folder-tree__excluded [aria-hidden="true"]').text()).toBe(`${MARK}excluded`)
		expect(excluded.find('.folder-tree__excluded .hidden-visually').text()).toBe(`${MARK}excluded from Photos`)
		expect(excluded.attributes('aria-selected')).toBe('false')
		expect(item(wrapper, '2026').find('.folder-tree__included').text()).toContain('included')

		await excluded.trigger('keydown', { key: ' ' })
		expect(wrapper.emitted('toggle')).toEqual([['/Photos/2025']])
	})

	// spec: LISTING-003.21
	it('marks the folders inside an excluded one neither included nor excluded', async () => {
		const { wrapper, answer } = await mountTree(['/Photos'], true, TREE, ['/Photos/2026'])
		await answer('/Photos')
		await twisty(wrapper, '2026').trigger('click')
		await answer('/Photos/2026')
		const raw = item(wrapper, 'Raw')

		expect(raw.find('.folder-tree__included').exists()).toBe(false)
		expect(raw.find('.folder-tree__box--included').exists()).toBe(false)
		expect(raw.find('.folder-tree__excluded').exists()).toBe(false)
		expect(raw.find('.folder-tree__name--excluded').exists()).toBe(false)
	})

	// spec: LISTING-003.22
	it('counts the excluded folders below a folder in a badge, collapsed or expanded', async () => {
		const { wrapper, answer } = await mountTree(['/Photos'], true, TREE, ['/Photos/2025'])
		const badge = () => item(wrapper, 'Photos').find('.folder-tree__badge--excluded')

		expect(badge().find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}1 excluded`)
		expect(badge().find('.hidden-visually').text()).toBe(`${MARK}${MARK}1 excluded folder inside`)
		await answer('/Photos')
		await twisty(wrapper, 'Photos').trigger('click')
		expect(item(wrapper, 'Photos').attributes('aria-expanded')).toBe('false')
		expect(badge().exists()).toBe(true)
	})

	// spec: LISTING-003.22
	it('marks nothing excluded while Include subfolders is off', async () => {
		const { wrapper, answer } = await mountTree(['/Photos'], false, TREE, ['/Photos/2025'])
		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')

		expect(wrapper.find('.folder-tree__name--excluded').exists()).toBe(false)
		expect(wrapper.find('.folder-tree__excluded').exists()).toBe(false)
		expect(wrapper.find('.folder-tree__badge--excluded').exists()).toBe(false)
	})
})
