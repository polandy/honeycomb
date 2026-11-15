// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Settings } from '../../../src/logic/settings.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SidecarSettings from '../../../src/components/SidecarSettings.vue'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

/** The section over the given settings. */
function mountSection(settings: Partial<Settings> = {}) {
	return mount(SidecarSettings, {
		props: { settings: { ...DEFAULT_SETTINGS, ...settings } },
		global: { stubs: { NcDialog: DialogStub } },
	})
}

type Wrapper = ReturnType<typeof mountSection>

const plain = (text: string) => text.replaceAll(MARK, '').replace(/\s+/g, ' ').trim()
const radios = (wrapper: Wrapper) => wrapper.findAll('.checkbox-radio-switch')
const radioOf = (wrapper: Wrapper, label: string) => radios(wrapper).find((item) => plain(item.text()).startsWith(label))!.find('input')
const checked = (wrapper: Wrapper) => radios(wrapper).map((item) => item.find('input').element as HTMLInputElement).filter((input) => input.checked).map((input) => input.value)
const dialog = (wrapper: Wrapper) => wrapper.find('[role="dialog"]')
const button = (wrapper: Wrapper, label: string) => dialog(wrapper).findAll('button').find((each) => plain(each.text()) === label)!
const updates = (wrapper: Wrapper) => wrapper.emitted('update') ?? []

describe('SidecarSettings', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SETTINGS-001.7, SETTINGS-001.24
	it('shows the three choices with Off checked, all translated', () => {
		const wrapper = mountSection()

		expect(radios(wrapper)).toHaveLength(3)
		expect(checked(wrapper)).toEqual(['off'])
		expect(dialog(wrapper).exists()).toBe(false)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: SETTINGS-001.24
	it.each(['existing', 'existing-and-new'] as const)('asks before leaving Off for %s and applies it on Write to sidecars', async (mode) => {
		const wrapper = mountSection()

		await radioOf(wrapper, mode === 'existing' ? 'Only existing sidecars' : 'Existing and new sidecars').setValue(true)
		expect(updates(wrapper)).toEqual([])
		expect(plain(dialog(wrapper).attributes('name')!)).toBe('Write decisions to XMP sidecars?')
		expect(untranslatedText(dialog(wrapper).element as Element)).toEqual([])

		await button(wrapper, 'Write to sidecars').trigger('click')

		expect(updates(wrapper)).toEqual([[{ sidecarWrite: mode }]])
		expect(dialog(wrapper).exists()).toBe(false)
	})

	// spec: SETTINGS-001.24
	it('names the new sidecar files only when they will be created', async () => {
		const wrapper = mountSection()

		await radioOf(wrapper, 'Only existing sidecars').setValue(true)
		const existing = plain(dialog(wrapper).text())
		await button(wrapper, 'Cancel').trigger('click')
		await radioOf(wrapper, 'Existing and new sidecars').setValue(true)

		expect(existing).not.toContain('IMG_0001.NEF.xmp')
		expect(plain(dialog(wrapper).text())).toContain('IMG_0001.NEF.xmp')
	})

	// spec: SETTINGS-001.24
	it('keeps Off on Cancel and on closing the dialog', async () => {
		const wrapper = mountSection()

		await radioOf(wrapper, 'Only existing sidecars').setValue(true)
		await button(wrapper, 'Cancel').trigger('click')
		expect(checked(wrapper)).toEqual(['off'])
		await radioOf(wrapper, 'Existing and new sidecars').setValue(true)
		wrapper.findComponent(DialogStub).vm.$emit('update:open', false)
		await wrapper.vm.$nextTick()

		expect(updates(wrapper)).toEqual([])
		expect(dialog(wrapper).exists()).toBe(false)
		expect(checked(wrapper)).toEqual(['off'])
	})

	// spec: SETTINGS-001.24
	it('switches between the choices and back to Off at once', async () => {
		const wrapper = mountSection({ sidecarWrite: 'existing' })

		expect(checked(wrapper)).toEqual(['existing'])
		await radioOf(wrapper, 'Existing and new sidecars').setValue(true)
		await radioOf(wrapper, 'Off').setValue(true)

		expect(updates(wrapper)).toEqual([[{ sidecarWrite: 'existing-and-new' }], [{ sidecarWrite: 'off' }]])
		expect(dialog(wrapper).exists()).toBe(false)
	})
})
