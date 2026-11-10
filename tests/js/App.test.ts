// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import App from '../../src/App.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'

describe('App', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it('shows that no folder is chosen yet', () => {
		const wrapper = shallowMount(App, { global: { renderStubDefaultSlot: true } })

		expect(wrapper.html()).toContain(`${TRANSLATED_MARK}No folder chosen`)
	})

	it('renders no text that bypasses the catalogue', () => {
		const wrapper = shallowMount(App, { global: { renderStubDefaultSlot: true } })

		expect(wrapper.html()).toContain(TRANSLATED_MARK)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})
})
