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

/** The section over the given settings, with the Versions app on unless said otherwise. */
function mountSection(settings: Partial<Settings> = {}, versionsApp = true) {
	return mount(SidecarSettings, {
		props: { settings: { ...DEFAULT_SETTINGS, ...settings }, versionsApp },
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
	it('shows Off and On with Off checked, all translated', () => {
		const wrapper = mountSection()

		expect(radios(wrapper)).toHaveLength(2)
		expect(checked(wrapper)).toEqual(['off'])
		expect(dialog(wrapper).exists()).toBe(false)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: SETTINGS-001.24
	it('asks before turning On and applies it on Write to sidecars', async () => {
		const wrapper = mountSection()

		await radioOf(wrapper, 'On').setValue(true)
		expect(updates(wrapper)).toEqual([])
		expect(plain(dialog(wrapper).attributes('name')!)).toBe('Write decisions to XMP sidecars?')
		expect(plain(dialog(wrapper).text())).toContain('IMG_0001.NEF.xmp')
		expect(untranslatedText(dialog(wrapper).element as Element)).toEqual([])

		await button(wrapper, 'Write to sidecars').trigger('click')

		expect(updates(wrapper)).toEqual([[{ sidecarWrite: 'on' }]])
		expect(dialog(wrapper).exists()).toBe(false)
	})

	// spec: SETTINGS-001.24
	it('keeps Off on Cancel and on closing the dialog', async () => {
		const wrapper = mountSection()

		await radioOf(wrapper, 'On').setValue(true)
		await button(wrapper, 'Cancel').trigger('click')
		expect(checked(wrapper)).toEqual(['off'])
		await radioOf(wrapper, 'On').setValue(true)
		wrapper.findComponent(DialogStub).vm.$emit('update:open', false)
		await wrapper.vm.$nextTick()

		expect(updates(wrapper)).toEqual([])
		expect(dialog(wrapper).exists()).toBe(false)
		expect(checked(wrapper)).toEqual(['off'])
	})

	// spec: SETTINGS-001.24
	it('turns Off at once', async () => {
		const wrapper = mountSection({ sidecarWrite: 'on' })

		expect(checked(wrapper)).toEqual(['on'])
		await radioOf(wrapper, 'Off').setValue(true)

		expect(updates(wrapper)).toEqual([[{ sidecarWrite: 'off' }]])
		expect(dialog(wrapper).exists()).toBe(false)
	})

	// spec: SETTINGS-001.26
	it('cannot turn On without the Versions app, and says why', () => {
		const wrapper = mountSection({}, false)

		expect((radioOf(wrapper, 'On').element as HTMLInputElement).disabled).toBe(true)
		expect(plain(wrapper.text())).toContain('On needs the Versions app, so that every write can be undone; ask your administrator to enable it.')
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: SETTINGS-001.26
	it('shows the hint for a stored Only existing sidecars once and clears it', () => {
		const hinted = mountSection({ sidecarExistingHint: true })
		const plainSection = mountSection()

		expect(plain(hinted.text())).toContain('Only existing sidecars is gone; writing is Off until you turn it On.')
		expect(updates(hinted)).toEqual([[{ sidecarExistingHint: false }]])
		expect(plain(plainSection.text())).not.toContain('Only existing sidecars')
		expect(updates(plainSection)).toEqual([])
	})
})
