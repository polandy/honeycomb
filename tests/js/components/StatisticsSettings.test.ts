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
const resetButton = (wrapper: Wrapper) => wrapper.findAll('button').find((item) => plain(item.text()) === 'Reset statistics')!

describe('StatisticsSettings', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: STATS-001.2
	it('shows Keep statistics on by default with what it counts, every string translated', () => {
		const wrapper = mountSection()

		expect(plain(wrapper.find('.checkbox-radio-switch').text())).toBe('Keep statistics Counts what honeycomb does per day: pictures decided, moved to the trash bin, sidecars written. No file names, nothing leaves your Nextcloud.')
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
	it('asks before it resets, with Cancel focused and a destructive confirm', async () => {
		const wrapper = mountSection()
		expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)

		await resetButton(wrapper).trigger('click')

		const dialog = wrapper.findComponent(ConfirmDialog)
		expect(dialog.props()).toMatchObject({ title: `${MARK}Reset all statistics?`, confirmLabel: `${MARK}Reset statistics`, cancel: true, danger: true, focusCancel: true })
		expect(plain(dialog.text())).toContain('Your photos and sidecars stay as they are.')
		expect(wrapper.emitted('reset')).toBeUndefined()
	})

	// spec: STATS-001.3
	it('resets on confirm and closes the question', async () => {
		const wrapper = mountSection()
		await resetButton(wrapper).trigger('click')

		wrapper.findComponent(ConfirmDialog).vm.$emit('confirm')
		await wrapper.vm.$nextTick()

		expect(wrapper.emitted('reset')).toHaveLength(1)
		expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)
	})

	// spec: STATS-001.3
	it('changes nothing on Cancel', async () => {
		const wrapper = mountSection()
		await resetButton(wrapper).trigger('click')

		wrapper.findComponent(ConfirmDialog).vm.$emit('cancel')
		await wrapper.vm.$nextTick()

		expect(wrapper.emitted('reset')).toBeUndefined()
		expect(wrapper.findComponent(ConfirmDialog).exists()).toBe(false)
	})
})
