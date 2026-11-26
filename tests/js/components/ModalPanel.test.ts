// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ModalPanel from '../../../src/components/ModalPanel.vue'
import { DialogStub } from './stubs.ts'

enableAutoUnmount(afterEach)

function mountPanel(props: Record<string, unknown> = {}, body = '<p>Body</p>') {
	return mount(ModalPanel, {
		props: { title: 'Choose folders', ...props },
		slots: { default: body, actions: '<button>Done</button>' },
		global: { stubs: { NcDialog: DialogStub } },
	})
}

const dialog = (wrapper: ReturnType<typeof mountPanel>) => wrapper.find('[role="dialog"]')

describe('ModalPanel', () => {
	// spec: APP-001.24
	it('is a dialog named by its title with its body and actions', () => {
		const wrapper = mountPanel()

		expect(dialog(wrapper).attributes('name')).toBe('Choose folders')
		expect(wrapper.text()).toBe('BodyDone')
	})

	// spec: APP-001.23
	it('closes by its close button, Escape and the backdrop by default', () => {
		const attributes = dialog(mountPanel()).attributes()

		expect(attributes['data-no-close']).toBe('false')
		expect(attributes['data-close-outside']).toBe('true')
	})

	// spec: APP-001.23
	it('offers no way to close while it cannot be closed', () => {
		const attributes = dialog(mountPanel({ locked: true })).attributes()

		expect(attributes['data-no-close']).toBe('true')
		expect(attributes['data-close-outside']).toBe('false')
	})

	// spec: APP-001.23
	it('emits close as soon as the dialog starts closing, before its fade', () => {
		const wrapper = mountPanel()
		expect(wrapper.emitted('close')).toBeUndefined()

		wrapper.findComponent(DialogStub).vm.$emit('closing')

		expect(wrapper.emitted('close')).toEqual([[]])
	})

	// spec: APP-001.16
	it.each(['checkbox', 'radio'])('closes on Escape from a %s', async (type) => {
		const wrapper = mountPanel({}, `<input type="${type}">`)

		await wrapper.find('input').trigger('keydown', { key: 'Escape' })

		expect(wrapper.emitted('close')).toEqual([[]])
	})

	// spec: APP-001.16
	it('leaves Escape to a text field and to a panel that cannot be closed', async () => {
		const text = mountPanel({}, '<input type="text">')
		await text.find('input').trigger('keydown', { key: 'Escape' })
		const busy = mountPanel({ locked: true }, '<input type="checkbox">')
		await busy.find('input').trigger('keydown', { key: 'Escape' })

		expect(text.emitted('close')).toBeUndefined()
		expect(busy.emitted('close')).toBeUndefined()
	})

	// spec: APP-001.23
	it('marks the Escape it closes on as handled, so the screen behind it does not act on it too', () => {
		const press = (target: Element) => {
			const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
			target.dispatchEvent(event)
			return event.defaultPrevented
		}

		expect(press(mountPanel({}, '<button>Go</button>').find('button').element)).toBe(true)
		expect(press(mountPanel({}, '<input type="checkbox">').find('input').element)).toBe(true)
		expect(press(mountPanel({}, '<input type="text">').find('input').element)).toBe(false)
		expect(press(mountPanel({ locked: true }, '<button>Go</button>').find('button').element)).toBe(false)
	})

	// spec: APP-001.6
	it('is a bottom sheet on a phone unless it fills the screen', () => {
		expect(dialog(mountPanel()).classes()).toContain('modal-panel--sheet')
		expect(dialog(mountPanel({ size: 'large' })).attributes('data-size')).toBe('large')
		expect(dialog(mountPanel({ size: 'full' })).classes()).not.toContain('modal-panel--sheet')
	})

	it('opens in the page body unless given a container', () => {
		expect(dialog(mountPanel()).attributes('data-container')).toBe('body')
		expect(dialog(mountPanel({ container: '.photo-loupe' })).attributes('data-container')).toBe('.photo-loupe')
	})

	// spec: APP-001.24
	it('holds the page still while it is open', () => {
		const page = document.documentElement
		const wrapper = mountPanel()
		expect(page.style.overflow).toBe('hidden')

		wrapper.unmount()

		expect(page.style.overflow).toBe('')
	})
})
