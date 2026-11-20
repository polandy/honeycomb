// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount, shallowMount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import NcButton from '@nextcloud/vue/components/NcButton'
import ConfirmDialog from '../../../src/components/ConfirmDialog.vue'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue, untranslatedText } from '../l10n/marked-catalogue.ts'
import { DialogStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

const CHECKBOX = '<input type="checkbox">'

function mountDialog(props: Record<string, unknown> = {}, body = '<p>Body</p>') {
	return mount(ConfirmDialog, {
		props: { title: 'Choose folders', confirmLabel: 'Cull 2 folders', ...props },
		slots: { default: body },
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

	it('makes the confirm button secondary on request, primary by default', () => {
		const confirmVariant = (props: Record<string, unknown>) => mountDialog(props).findAllComponents(NcButton).at(-1)!.props('variant')

		expect(confirmVariant({})).toBe('primary')
		expect(confirmVariant({ secondary: true })).toBe('secondary')
	})

	// spec: DELETE-002.20
	it('puts the focus on Cancel on request', async () => {
		const wrapper = mount(ConfirmDialog, { props: { title: 'T', confirmLabel: 'Delete', cancel: true, danger: true, focusCancel: true }, global: { stubs: { NcDialog: DialogStub } }, attachTo: document.body })
		await nextTick()

		expect(document.activeElement?.textContent?.trim()).toBe(`${MARK}Cancel`)
		wrapper.unmount()
	})

	it('disables the confirm button on request', () => {
		expect(mountDialog({ confirmDisabled: true }).find('button').attributes('disabled')).toBeDefined()
	})

	// spec: DELETE-002.13, MOVE-004.17
	it('shows how many photos were sent while a send runs, and nothing otherwise', () => {
		const bar = mountDialog({ progress: { done: 50, total: 120 } }).find('[role="progressbar"]')

		expect(bar.attributes()).toMatchObject({ 'aria-valuenow': '50', 'aria-valuemax': '120', 'aria-label': expect.stringMatching(/^\[de\] .*50 of 120 photos sent$/) })
		expect(mountDialog({ progress: { done: 50, total: 120 } }).text()).toContain('50 of 120 photos sent')
		expect(mountDialog({ progress: null }).find('[role="progressbar"]').exists()).toBe(false)
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

	// spec: APP-001.16
	it.each([['checkbox', 1], ['radio', 1], ['text', 0]])('emits cancel on Escape from a %s input %i times', async (type, times) => {
		const wrapper = mountDialog({ cancel: true }, `<input type="${type}">`)

		await wrapper.find('input').trigger('keydown', { key: 'Escape' })

		expect(wrapper.emitted('cancel') ?? []).toHaveLength(times)
	})

	// spec: APP-001.16
	it('stays open on Escape from a checkbox without Cancel, and on another key', async () => {
		const uncancellable = mountDialog({}, CHECKBOX)
		const cancellable = mountDialog({ cancel: true }, CHECKBOX)

		await uncancellable.find('input').trigger('keydown', { key: 'Escape' })
		await cancellable.find('input').trigger('keydown', { key: 'Enter' })

		expect(uncancellable.emitted('cancel')).toBeUndefined()
		expect(cancellable.emitted('cancel')).toBeUndefined()
	})

	it('opens in the body, or inside the given container', () => {
		const dialog = (props: Record<string, unknown>) => shallowMount(ConfirmDialog, { props: { title: 'T', confirmLabel: 'C', ...props } }).findComponent({ name: 'NcDialog' })

		expect(dialog({}).props('container')).toBe('body')
		expect(dialog({ container: '.photo-loupe' }).props('container')).toBe('.photo-loupe')
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
