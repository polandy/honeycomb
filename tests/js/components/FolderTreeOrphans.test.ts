// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { FOLDERS, item, mountTree, twisty } from './folder-tree-fixture.ts'

const MARK = TRANSLATED_MARK

describe('FolderTree orphaned sidecars', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: LISTING-003.23
	it('notes the orphaned sidecars of a folder before its count, also without pictures, spoken as part of the folder', async () => {
		const stray = { ...FOLDERS['']![0]!, orphanedSidecars: 1, orphanedSidecarsBelow: 7 }
		const only = { ...FOLDERS['']![2]!, orphanedSidecars: 2, orphanedSidecarsBelow: 2 }
		const { wrapper, answer } = await mountTree([], false, { ...FOLDERS, '': [stray, FOLDERS['']![1]!, only, FOLDERS['']![3]!] })
		const note = (name: string) => item(wrapper, name).find('.folder-tree__orphans')

		expect(note('Photos').find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}7 orphaned sidecars`)
		expect(note('Photos').find('.hidden-visually').text()).toBe(`${MARK}${MARK}7 orphaned sidecars`)
		expect(note('Photos').element.nextElementSibling?.classList).toContain('folder-tree__count')
		expect(note('Day 10').find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}2 orphaned sidecars`)
		expect(item(wrapper, 'Day 10').find('.folder-tree__count').exists()).toBe(false)
		expect(note('Day 9').exists()).toBe(false)
		expect(note('.hidden').exists()).toBe(false)

		await twisty(wrapper, 'Photos').trigger('click')
		await answer('/Photos')
		expect(note('Photos').find('[aria-hidden="true"]').text()).toBe(`${MARK}${MARK}1 orphaned sidecar`)
	})
})
