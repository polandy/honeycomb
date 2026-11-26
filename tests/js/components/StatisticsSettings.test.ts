// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Settings } from '../../../src/logic/settings.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import StatisticsSettings from '../../../src/components/StatisticsSettings.vue'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

function mountSection(settings: Partial<Settings> = {}) {
	return mount(StatisticsSettings, { props: { settings: { ...DEFAULT_SETTINGS, ...settings } }, global: { stubs: { NcDialog: DialogStub } } })
}

type Wrapper = ReturnType<typeof mountSection>

const plain = (text: string) => text.replaceAll(MARK, '').replace(/\s+/g, ' ').trim()
const keepSwitch = (wrapper: Wrapper) => wrapper.find('.checkbox-radio-switch input')

describe('StatisticsSettings', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: STATS-001.2
	it('shows Keep statistics on by default with what it counts, every string translated', () => {
		const wrapper = mountSection()

		const text = plain(wrapper.find('.checkbox-radio-switch').text())
		expect(text).toContain('Keep statistics')
		expect(text).toContain('Counts what honeycomb does per day: photos decided, moved to the trash bin, sidecars written. No file names, nothing leaves your Nextcloud.')
		expect((keepSwitch(wrapper).element as HTMLInputElement).checked).toBe(true)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: STATS-001.1
	it('turns Keep statistics off and on again', async () => {
		const off = mountSection()
		await keepSwitch(off).setValue(false)
		const on = mountSection({ keepStatistics: false })
		await keepSwitch(on).setValue(true)

		expect(off.emitted('update')).toEqual([[{ keepStatistics: false }]])
		expect(on.emitted('update')).toEqual([[{ keepStatistics: true }]])
	})

	// spec: STATS-001.3
	it('offers no way to reset the statistics', () => {
		const wrapper = mountSection()

		expect(wrapper.findAll('button')).toEqual([])
		expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)
		expect(plain(wrapper.text())).not.toMatch(/reset/i)
	})
})
