// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CullEmptyState from '../../../src/components/CullEmptyState.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK

enableAutoUnmount(afterEach)

describe('CullEmptyState', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-002.11
	it('offers Change folders and points at the File types setting when the folders hold no photos', async () => {
		const wrapper = mount(CullEmptyState, { props: { reason: 'no-pictures', rejected: 0 } })

		expect(wrapper.text()).toContain(`${MARK}No photos in these folders`)
		expect(wrapper.text()).toContain(`${MARK}If your photos use other file types, add them in Settings › File types.`)
		expect(untranslatedText(wrapper.element)).toEqual([])
		const button = wrapper.findAll('button').find((each) => each.text() === `${MARK}Change folders`)
		expect(button).toBeDefined()

		await button!.trigger('click')

		expect(wrapper.emitted('changeFolders')).toHaveLength(1)
	})

	// spec: GRID-002.11
	it('offers Clear filters when nothing matches the filters', () => {
		const wrapper = mount(CullEmptyState, { props: { reason: 'no-match', rejected: 0 } })

		expect(wrapper.text()).toContain(`${MARK}Nothing matches these filters`)
		expect(wrapper.findAll('button').map((each) => each.text())).toContain(`${MARK}Clear filters`)
	})
})
