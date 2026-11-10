// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

function mountDialog(props: Record<string, unknown> = {}) {
	return mount(ConfirmDialog, {
		props: { title: 'Choose folders', confirmLabel: 'Cull 2 folders', ...props },
		slots: { default: '<p>Body</p>' },
		global: { stubs: { NcDialog: DialogStub } },
	})
}

describe('ConfirmDialog', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	it('shows the title, the body and the confirm button', () => {
		const wrapper = mountDialog()

		expect(wrapper.find('[role="dialog"]').attributes('name')).toBe('Choose folders')
		expect(wrapper.text()).toContain('Body')
		expect(wrapper.findAll('button').map((button) => button.text())).toEqual(['Cull 2 folders'])
	})

	it('orders the footer Back, Cancel, then the confirm button', () => {
		const wrapper = mountDialog({ back: true, cancel: true })

		expect(wrapper.findAll('button').map((button) => button.text())).toEqual([`${MARK}Back`, `${MARK}Cancel`, 'Cull 2 folders'])
	})

	it.each([['back', 0], ['cancel', 1], ['confirm', 2]] as const)('emits %s when its button is pressed', async (event, index) => {
		const wrapper = mountDialog({ back: true, cancel: true })

		await wrapper.findAll('button')[index]!.trigger('click')

		expect(Object.keys(wrapper.emitted())).toContain(event)
	})

	it('disables the confirm button on request', () => {
		expect(mountDialog({ confirmDisabled: true }).find('button').attributes('disabled')).toBeDefined()
	})

	it('can be closed only when it can be cancelled', () => {
		expect(mountDialog({ cancel: true }).find('[role="dialog"]').attributes('data-no-close')).toBe('false')
		expect(mountDialog().find('[role="dialog"]').attributes('data-no-close')).toBe('true')
	})

	it('emits cancel when the dialog closes', () => {
		const wrapper = mountDialog({ cancel: true })

		wrapper.findComponent(DialogStub).vm.$emit('update:open', false)

		expect(wrapper.emitted('cancel')).toHaveLength(1)
	})

	it('renders no text that bypasses the catalogue', () => {
		const wrapper = shallowMount(ConfirmDialog, {
			props: { title: `${MARK}Title`, confirmLabel: `${MARK}Confirm`, back: true, cancel: true },
			global: { renderStubDefaultSlot: true, stubs: { NcDialog: DialogStub } },
		})

		expect(wrapper.html()).toContain(`${MARK}Back`)
		expect(untranslatedText(wrapper.element as Element)).toEqual([])
	})
})
