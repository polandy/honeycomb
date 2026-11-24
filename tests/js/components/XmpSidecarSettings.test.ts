// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Settings } from '../../../src/logic/settings.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import XmpSidecarSettings from '../../../src/components/XmpSidecarSettings.vue'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

function mountSection(settings: Partial<Settings> = {}) {
	return mount(XmpSidecarSettings, { props: { settings: { ...DEFAULT_SETTINGS, ...settings } } })
}

type Wrapper = ReturnType<typeof mountSection>

const plain = (text: string) => text.replaceAll(TRANSLATED_MARK, '').replace(/\s+/g, ' ').trim()
const flagSwitch = (wrapper: Wrapper) => wrapper.find('.checkbox-radio-switch input')

describe('XmpSidecarSettings', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SETTINGS-001.34
	it('shows the flag switch on by default with what it does, every string translated', () => {
		const wrapper = mountSection()

		const text = plain(wrapper.find('.checkbox-radio-switch').text())
		expect(text).toContain('Write picks, rejects and Keep RAW to XMP sidecars')
		expect(text).toContain('digiKam sees them at once, and a pick or reject changed in digiKam is taken over on the next visit. Stars, colour labels and tags are written either way.')
		expect((flagSwitch(wrapper).element as HTMLInputElement).checked).toBe(true)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: SETTINGS-001.34
	it('shows a stored off and turns the switch off and on again', async () => {
		const off = mountSection()
		await flagSwitch(off).setValue(false)
		const on = mountSection({ writeFlagsToXmp: false })
		expect((flagSwitch(on).element as HTMLInputElement).checked).toBe(false)
		await flagSwitch(on).setValue(true)

		expect(off.emitted('update')).toEqual([[{ writeFlagsToXmp: false }]])
		expect(on.emitted('update')).toEqual([[{ writeFlagsToXmp: true }]])
	})
})
