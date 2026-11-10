// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Settings } from '../../../src/logic/settings.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import MoveSettings from '../../../src/components/MoveSettings.vue'
import { DEFAULT_NAME_TEMPLATE } from '../../../src/logic/name-template/presets.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'

const MARK = TRANSLATED_MARK
const FULL_DATE = '{date:%Y}/{date:%Y-%m-%d}/{date:%Y%m%d-%H%M%S}_{camera}_{name}.{ext}'

/** The section over the given settings, re-rendered with each update it emits. */
function mountSection(settings: Partial<Settings> = {}) {
	const wrapper = mount(MoveSettings, { props: { settings: { ...DEFAULT_SETTINGS, ...settings } } })
	return wrapper
}

type Wrapper = ReturnType<typeof mountSection>

const plain = (text: string) => text.replaceAll(MARK, '').replace(/\s+/g, ' ').trim()
const radios = (wrapper: Wrapper) => wrapper.findAll('.checkbox-radio-switch')
const radioOf = (wrapper: Wrapper, label: string) => radios(wrapper).find((item) => plain(item.text()) === label)!
const checked = (wrapper: Wrapper) => radios(wrapper).filter((item) => (item.find('input').element as HTMLInputElement).checked).map((item) => plain(item.text()))
const field = (wrapper: Wrapper) => wrapper.find(`input[aria-label="${MARK}Name template"]`)
const previewRows = (wrapper: Wrapper) => wrapper.findAll('.move-settings__preview li').map((row) => plain(row.text()))
const updates = (wrapper: Wrapper) => wrapper.emitted('update') ?? []

describe('MoveSettings', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SETTINGS-001.7, SETTINGS-001.17
	it('shows the template with its preset chosen, every string translated', () => {
		const wrapper = mountSection()

		expect(radios(wrapper).map((item) => plain(item.text()))).toEqual(['By day', 'By day, full date in the name', 'Keep names'])
		expect(checked(wrapper)).toEqual(['By day'])
		expect((field(wrapper).element as HTMLInputElement).value).toBe(DEFAULT_NAME_TEMPLATE)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})

	// spec: SETTINGS-001.17
	it('sets a preset, and chooses none for the user\'s own template', async () => {
		const wrapper = mountSection({ moveTemplate: '{name:lower}.{ext}' })
		expect(checked(wrapper)).toEqual([])

		await radioOf(wrapper, 'By day, full date in the name').find('input').setValue(true)

		expect(updates(wrapper)).toEqual([[{ moveTemplate: FULL_DATE }]])
	})

	// spec: SETTINGS-001.19
	it('previews the 5 sample pictures with their notes and says all names are unique', () => {
		const wrapper = mountSection()

		expect(previewRows(wrapper)).toEqual([
			'DSCF1234.JPG + .RAF · X-T5 2026/2026-11-09/143205_X-T5_DSCF1234.JPG 2026/2026-11-09/143205_X-T5_DSCF1234.RAF',
			'DSCF1234.JPG + .RAF · X-H2 2026/2026-11-09/143205_X-H2_DSCF1234.JPG 2026/2026-11-09/143205_X-H2_DSCF1234.RAF',
			'IMG_0042.JPG + .DNG · iPhone 15 Pro 2026/2026-11-09/143205_iPhone-15-Pro_IMG_0042.JPG 2026/2026-11-09/143205_iPhone-15-Pro_IMG_0042.DNG',
			'DSC_0815.NEF + .NEF.xmp · NIKON Z 6_2 2026/2026-11-09/091500_NIKON-Z-6_2_DSC_0815.NEF 2026/2026-11-09/091500_NIKON-Z-6_2_DSC_0815.NEF.xmp',
			'Übersicht März.jpg · no EXIF 2026/2026-11-09/180241_unknown_Uebersicht-Maerz.jpg no EXIF time: file time no camera model: unknown',
		])
		expect(plain(wrapper.find('.move-settings__summary').text())).toBe('All 5 sample photos get unique names, even the two cameras that shot at the same second.')
	})

	// spec: SETTINGS-001.19
	it('marks a collision and a picture {number} cannot name, and counts the collisions', async () => {
		const wrapper = mountSection({ moveTemplate: '{number}.{ext}' })

		expect(previewRows(wrapper)[1]).toBe('DSCF1234.JPG + .RAF · X-H2 1234-2.JPG 1234-2.RAF collision: -2 added')
		expect(previewRows(wrapper)[4]).toBe('Übersicht März.jpg · no EXIF cannot be named: its file name does not end in digits for {number}')
		expect(plain(wrapper.find('.move-settings__summary').text())).toBe('1 of 5 sample photos collides with another one and gets a -2, -3 suffix. Add {camera} and the time to the name to keep names unique.')
	})

	// spec: SETTINGS-001.18
	it('saves a valid template as it is typed', async () => {
		const wrapper = mountSection()

		await field(wrapper).setValue('{name:lower}.{ext}')

		expect(updates(wrapper)).toEqual([[{ moveTemplate: '{name:lower}.{ext}' }]])
	})

	// spec: SETTINGS-001.18
	it('shows an invalid template with a caret under its problem and does not save it', async () => {
		const wrapper = mountSection()

		await field(wrapper).setValue('{name} .{ext}')

		expect(updates(wrapper)).toEqual([])
		expect(wrapper.find('[role="alert"]').text()).toBe(`{name} .{ext}\n      ^ ${MARK}Whitespace is not allowed; use - or _`)
		expect(plain(wrapper.find('.move-settings__unsaved').text())).toBe('Not saved: moving keeps using the last valid template.')
		expect(wrapper.find('.move-settings__preview').exists()).toBe(false)
	})

	// spec: SETTINGS-001.18
	it('shows the saved template again once a preset or a new setting replaces the draft', async () => {
		const wrapper = mountSection()
		await field(wrapper).setValue('{name')

		await radioOf(wrapper, 'Keep names').find('input').setValue(true)
		await wrapper.setProps({ settings: { ...DEFAULT_SETTINGS, moveTemplate: '{name}.{ext}' } })

		expect((field(wrapper).element as HTMLInputElement).value).toBe('{name}.{ext}')
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
	})

	// spec: SETTINGS-001.20
	it('lists the favourite targets and removes one by its ✕', async () => {
		const wrapper = mountSection({ moveFavourites: ['/Photos/Best', '/Archive'] })

		expect(wrapper.findAll('.move-settings__favourite').map((chip) => plain(chip.text()))).toEqual(['★ Best', '★ Archive'])
		await wrapper.find(`button[aria-label="${MARK}Remove favourite /Photos/Best"]`).trigger('click')

		expect(updates(wrapper)).toEqual([[{ moveFavourites: ['/Archive'] }]])
	})

	// spec: SETTINGS-001.20
	it('says how to add a favourite target when there is none', () => {
		const wrapper = mountSection()

		expect(plain(wrapper.find('.move-settings__favourites').text())).toBe('None yet: add one in the move dialog.')
	})
})
