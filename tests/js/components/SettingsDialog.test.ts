// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Settings } from '../../../src/logic/settings.ts'

import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import SettingsDialog from '../../../src/components/SettingsDialog.vue'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { AppSettingsDialogStub, AppSettingsSectionStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

/** The open dialog over the given settings. */
function mountDialog(settings: Partial<Settings> = {}, gestureGuideSeen = false) {
	return mount(SettingsDialog, {
		props: { open: true, settings: { ...DEFAULT_SETTINGS, ...settings }, gestureGuideSeen },
		global: { stubs: { NcAppSettingsDialog: AppSettingsDialogStub, NcAppSettingsSection: AppSettingsSectionStub } },
	})
}

type Wrapper = ReturnType<typeof mountDialog>

const plain = (text: string) => text.replaceAll(MARK, '').trim()
const group = (wrapper: Wrapper, name: string) => wrapper.find(`[role="group"][aria-label="${MARK}${name}"]`)
const chips = (wrapper: Wrapper, name: string) => group(wrapper, name).findAll('.settings-dialog__extension').map((chip) => plain(chip.text()))
const switchOf = (wrapper: Wrapper, label: string) => wrapper.findAll('.checkbox-radio-switch').find((item) => plain(item.text()).startsWith(label))!.find('input')

/** Types the extension into the add field of the named list and submits it. */
async function addTo(wrapper: Wrapper, name: string, extension: string) {
	await group(wrapper, name).find(`input[aria-label="${MARK}Add extension"]`).setValue(extension)
	await group(wrapper, name).find('form').trigger('submit')
}

describe('SettingsDialog', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: SETTINGS-001.7
	it('shows the sections of the settings, all translated', () => {
		const wrapper = mountDialog()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe(`${MARK}Settings`)
		expect(wrapper.findAll('h3').map((heading) => plain(heading.text()))).toEqual(['File types', 'Folder layout', 'Loupe gestures', 'Keyboard', 'Moving photos'])
		expect(untranslatedText(wrapper.element as Element)).toEqual([...DEFAULT_SETTINGS.rawExtensions, ...DEFAULT_SETTINGS.renderedExtensions].map((extension) => `.${extension.toUpperCase()}`))
	})

	// spec: SETTINGS-001.7
	it('emits the closing of the dialog', async () => {
		const wrapper = mountDialog()

		wrapper.findComponent(AppSettingsDialogStub).vm.$emit('update:open', false)

		expect(wrapper.emitted('update:open')).toEqual([[false]])
	})

	// spec: SETTINGS-001.22
	it('asks to show the gesture guide again; the hint follows whether it was seen', async () => {
		const unseen = mountDialog({}, false)
		const hint = (wrapper: Wrapper) => plain(wrapper.find('#gesture-guide-hint').text())
		expect(hint(unseen)).toBe('Shows the next time you open the loupe')
		expect(hint(mountDialog({}, true))).toBe('The card with the swipes, tap zones and keys from the first loupe opening')

		const button = unseen.findAll('button').find((item) => plain(item.text()) === 'Show the gesture guide')!
		expect(button.attributes('aria-describedby')).toBe('gesture-guide-hint')
		await button.trigger('click')

		expect(unseen.emitted('showGestureGuide')).toHaveLength(1)
	})

	// spec: SETTINGS-001.8
	it('lists the extensions and removes one', async () => {
		const wrapper = mountDialog({ rawExtensions: ['nef', 'cr3', 'dng'] })
		expect(chips(wrapper, 'RAW extensions')).toEqual(['.NEF', '.CR3', '.DNG'])

		// spec: APP-002.9
		expect(wrapper.find(`button[aria-label="${MARK}Remove CR3"]`).attributes('data-tip')).toBe(`${MARK}Remove CR3`)
		await wrapper.find(`button[aria-label="${MARK}Remove CR3"]`).trigger('click')

		expect(wrapper.emitted('update')).toEqual([[{ rawExtensions: ['nef', 'dng'] }]])
	})

	// spec: SETTINGS-001.8
	it('keeps the last extension of a list', () => {
		const wrapper = mountDialog({ renderedExtensions: ['jpg'] })

		expect(wrapper.find(`button[aria-label="${MARK}Remove JPG"]`).attributes('disabled')).toBeDefined()
	})

	// spec: SETTINGS-001.8
	it('adds an extension and clears the field', async () => {
		const wrapper = mountDialog()

		await addTo(wrapper, 'Rendered extensions', '.tif')

		expect(wrapper.emitted('update')).toEqual([[{ renderedExtensions: [...DEFAULT_SETTINGS.renderedExtensions, 'tif'] }]])
		expect((group(wrapper, 'Rendered extensions').find('input').element as HTMLInputElement).value).toBe('')
	})

	it.each([
		['', 'Type an extension.'],
		['xmp', 'Sidecars are paired with their photo, they cannot be a photo type.'],
		['tar.gz', 'An extension has only letters and digits.'],
		['nef', '.NEF is already in this list.'],
		['jpg', '.JPG is already in the other list.'],
	])('refuses %j and says why until the next try', async (extension, reason) => {
		const wrapper = mountDialog()

		await addTo(wrapper, 'RAW extensions', extension)

		expect(wrapper.emitted('update')).toBeUndefined()
		expect(plain(group(wrapper, 'RAW extensions').find('.settings-dialog__error').text())).toBe(reason)
		await addTo(wrapper, 'RAW extensions', 'xyz')
		expect(group(wrapper, 'RAW extensions').find('.settings-dialog__error').exists()).toBe(false)
	})

	// spec: SETTINGS-001.9
	it('switches to separate subfolders with the default names and back', async () => {
		const wrapper = mountDialog()
		expect(wrapper.find(`input[aria-label="${MARK}RAW folder"]`).exists()).toBe(false)

		await wrapper.find('input[type="radio"][value="separate-subfolders"]').setValue(true)

		expect(wrapper.emitted('update')).toEqual([[{ folderMode: { kind: 'separate-subfolders', rawSubfolder: 'RAW', renderedSubfolder: 'JPG' } }]])
	})

	// spec: SETTINGS-001.9
	it('changes the subfolder names, an empty one back to its default', async () => {
		const wrapper = mountDialog({ folderMode: { kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'Out' } })
		expect(wrapper.text()).toContain(`${MARK}Folder names are matched ignoring case.`)

		await wrapper.find(`input[aria-label="${MARK}Rendered folder"]`).setValue('JPEG')
		await wrapper.find(`input[aria-label="${MARK}RAW folder"]`).setValue(' ')
		await wrapper.find('input[type="radio"][value="same-folder"]').setValue(true)

		expect(wrapper.emitted('update')).toEqual([
			[{ folderMode: { kind: 'separate-subfolders', rawSubfolder: 'Raws', renderedSubfolder: 'JPEG' } }],
			[{ folderMode: { kind: 'separate-subfolders', rawSubfolder: 'RAW', renderedSubfolder: 'Out' } }],
			[{ folderMode: { kind: 'same-folder' } }],
		])
	})

	// spec: SETTINGS-001.10
	it.each([
		['Show singles', 'showSingles'],
		['Auto-advance to the next undecided photo', 'autoAdvance'],
		['Show flag buttons', 'flagButtonsShown'],
		['Pin the filmstrip', 'filmstripPinned'],
		['Pin the rating row', 'ratingRowPinned'],
		['Vi keys', 'viKeys'],
	] as const)('turns %s on and off', async (label, key) => {
		const wrapper = mountDialog({ [key]: true })

		await switchOf(wrapper, label).setValue(false)

		expect(wrapper.emitted('update')).toEqual([[{ [key]: false }]])
	})

	// spec: SETTINGS-001.10
	it('sets what each swipe does, Nothing turning it off', async () => {
		const wrapper = mountDialog()
		const up = wrapper.find(`select[aria-label="${MARK}Swipe up"]`)
		expect((up.element as HTMLSelectElement).value).toBe('picked')

		await up.setValue('')
		await wrapper.find(`select[aria-label="${MARK}Swipe down"]`).setValue('picked')

		expect(wrapper.emitted('update')).toEqual([[{ swipes: { up: null, down: 'rejected' } }], [{ swipes: { up: 'picked', down: 'picked' } }]])
	})

	// spec: SETTINGS-001.20
	it('passes on a change in Moving photos', async () => {
		const wrapper = mountDialog({ moveFavourites: ['/Photos/Best'] })

		await wrapper.find(`button[aria-label="${MARK}Remove favourite /Photos/Best"]`).trigger('click')

		expect(wrapper.emitted('update')).toEqual([[{ moveFavourites: [] }]])
	})
})
