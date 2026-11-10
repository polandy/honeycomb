// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import AppTooltip from '../../../src/components/AppTooltip.vue'
import { tip, TIP_ID } from '../../../src/tooltip.ts'
import { fakeScheduler } from '../fake-scheduler.ts'

/** A page with the tooltip, a control with a key, one without, a tile and a scrolling list. */
function mountPage() {
	const scheduler = fakeScheduler()
	const clicks: string[] = []
	const shown = ref(true)
	const tipsOff = ref(false)
	const Page = defineComponent({
		setup: () => () => h('div', { 'data-tips-off': tipsOff.value ? '' : undefined }, [
			h(AppTooltip, { schedule: scheduler.schedule, now: () => 0 }),
			h('div', { class: 'list' }, shown.value ? [h('button', { class: 'pick', ...tip('Pick', 'P'), onClick: () => clicks.push('pick') }, '✓')] : []),
			h('button', { class: 'more', ...tip('More') }, '…'),
			h('div', { class: 'tile', 'data-tip-hover-only': '', onClick: () => clicks.push('tile') }, [h('span', { class: 'badge', ...tip('Series of 3') }, '⧉')]),
			h('span', { class: 'plain' }, 'text'),
		]),
	})
	const wrapper = mount(Page, { attachTo: document.body })
	return { ...scheduler, clicks, shown, tipsOff, wrapper, control: (selector: string) => document.querySelector<HTMLElement>(selector)! }
}

const bubble = () => document.getElementById(TIP_ID)!
const isShown = () => bubble().style.display !== 'none'

/** Dispatches a pointer event on the element and lets Vue render. */
async function pointer(target: Element, type: string, init: PointerEventInit & { relatedTarget?: Element | null } = {}) {
	target.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', isPrimary: true, ...init }))
	await flushPromises()
}

/** Hovers the control until its tooltip shows. */
async function hover(page: ReturnType<typeof mountPage>, selector: string) {
	await pointer(page.control(selector), 'pointerover')
	page.fire()
	await flushPromises()
}

enableAutoUnmount(afterEach)

describe('AppTooltip', () => {
	afterEach(() => document.body.replaceChildren())

	// spec: APP-002.1, APP-002.7
	it('shows the label and key of the hovered control after the delay, described by the bubble', async () => {
		const page = mountPage()

		await pointer(page.control('.pick'), 'pointerover')
		expect(isShown()).toBe(false)
		page.fire()
		await flushPromises()

		expect(isShown()).toBe(true)
		expect(bubble().getAttribute('role')).toBe('tooltip')
		expect(bubble().querySelector('.app-tooltip__label')!.textContent).toBe('Pick')
		expect(bubble().querySelector('kbd')!.textContent).toBe('P')
		expect(page.control('.pick').getAttribute('aria-describedby')).toBe(TIP_ID)
		expect(bubble().contains(document.activeElement)).toBe(false)
	})

	// spec: APP-002.1, APP-002.7
	it('stays while the mouse moves onto the bubble and hides when it leaves for elsewhere', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		await pointer(page.control('.pick'), 'pointerout', { relatedTarget: bubble() })
		expect(isShown()).toBe(true)
		await pointer(bubble(), 'pointerout', { relatedTarget: page.control('.plain') })

		expect(isShown()).toBe(false)
		expect(page.control('.pick').hasAttribute('aria-describedby')).toBe(false)
	})

	// spec: APP-002.1
	it('moves on at once to the next control', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		await pointer(page.control('.pick'), 'pointerout', { relatedTarget: page.control('.more') })
		await pointer(page.control('.more'), 'pointerover')

		expect(bubble().querySelector('.app-tooltip__label')!.textContent).toBe('More')
		expect(bubble().querySelector('kbd')).toBeNull()
	})

	// spec: APP-002.2
	it('shows on keyboard focus and hides on blur', async () => {
		const page = mountPage()

		page.control('.more').focus()
		await flushPromises()
		expect(isShown()).toBe(true)
		page.control('.more').blur()
		await flushPromises()

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.3
	it('shows on a long-press, hides on release and swallows the click', async () => {
		const page = mountPage()

		await pointer(page.control('.pick'), 'pointerdown', { pointerType: 'touch' })
		page.fire()
		await flushPromises()
		expect(isShown()).toBe(true)
		await pointer(page.control('.pick'), 'pointerup', { pointerType: 'touch' })
		page.control('.pick').click()
		page.control('.pick').click()

		expect(isShown()).toBe(false)
		expect(page.clicks).toEqual(['pick'])
	})

	// spec: APP-002.3
	it('cancels the long-press when a second finger lands or the browser takes the pointer', async () => {
		const page = mountPage()

		await pointer(page.control('.pick'), 'pointerdown', { pointerType: 'touch' })
		await pointer(page.control('.pick'), 'pointerdown', { pointerType: 'touch', isPrimary: false })
		page.fire()
		await pointer(page.control('.pick'), 'pointerdown', { pointerType: 'touch' })
		await pointer(page.control('.pick'), 'pointercancel', { pointerType: 'touch' })
		page.fire()
		await flushPromises()

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.3
	it('cancels the long-press when the finger moves away and keeps the browser menu off a control', async () => {
		const page = mountPage()
		const menu = (selector: string) => page.control(selector).dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))

		await pointer(page.control('.pick'), 'pointerdown', { pointerType: 'touch', clientX: 10, clientY: 10 })
		await pointer(page.control('.pick'), 'pointermove', { pointerType: 'touch', clientX: 30, clientY: 10 })
		page.fire()
		await flushPromises()

		expect(isShown()).toBe(false)
		expect(menu('.pick')).toBe(false)
		expect(menu('.badge')).toBe(true)
	})

	// spec: APP-002.8
	it('leaves a tile its long-press and shows a badge on mouse hover only', async () => {
		const page = mountPage()

		await pointer(page.control('.badge'), 'pointerdown', { pointerType: 'touch' })
		expect(page.timers).toEqual([])
		page.control('.badge').click()
		expect(page.clicks).toEqual(['tile'])
		await hover(page, '.badge')

		expect(bubble().querySelector('.app-tooltip__label')!.textContent).toBe('Series of 3')
	})

	// spec: APP-002.4
	it('hides on a click elsewhere', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		await pointer(page.control('.plain'), 'pointerdown')

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.4
	it('hides when the control\'s container scrolls, not when another one does', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		page.control('.tile').dispatchEvent(new Event('scroll'))
		await flushPromises()
		expect(isShown()).toBe(true)
		page.control('.list').dispatchEvent(new Event('scroll'))
		await flushPromises()

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.4
	it('hides when the control leaves the page', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		page.shown.value = false
		await flushPromises()

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.4
	it('hides when the controls fade out and shows none while they are faded', async () => {
		const page = mountPage()
		await hover(page, '.pick')

		page.tipsOff.value = true
		await flushPromises()
		expect(isShown()).toBe(false)
		await hover(page, '.more')

		expect(isShown()).toBe(false)
	})

	// spec: APP-002.5
	it('takes the first Escape to hide itself and lets the next one through', async () => {
		const page = mountPage()
		const escapes = vi.fn()
		document.addEventListener('keydown', escapes)
		await hover(page, '.pick')

		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await flushPromises()
		expect(isShown()).toBe(false)
		expect(escapes).not.toHaveBeenCalled()
		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

		expect(escapes).toHaveBeenCalledOnce()
		document.removeEventListener('keydown', escapes)
	})

	// spec: APP-002.6
	it('places the bubble below a control near the top, its arrow at the control', async () => {
		const page = mountPage()
		vi.spyOn(page.control('.pick'), 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ x: 480, y: 100, width: 40, height: 40 }))

		await hover(page, '.pick')

		expect(bubble().dataset.side).toBe('bottom')
		expect(bubble().style.top).toBe('150px')
	})

	it('removes its listeners when unmounted', async () => {
		const page = mountPage()
		page.wrapper.unmount()
		const button = document.createElement('button')
		button.dataset.tip = 'More'
		document.body.append(button)

		await pointer(button, 'pointerover')

		expect(page.timers).toEqual([])
	})
})
