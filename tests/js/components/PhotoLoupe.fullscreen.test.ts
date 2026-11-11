// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { button, mountLoupe } from './mount-loupe.ts'

enableAutoUnmount(afterEach)

const stubDocument = (values: Record<string, unknown>) => Object.entries(values).forEach(([key, value]) => Object.defineProperty(document, key, { value, configurable: true }))
afterEach(() => ['fullscreenEnabled', 'webkitFullscreenEnabled', 'fullscreenElement', 'webkitFullscreenElement'].forEach((key) => Reflect.deleteProperty(document, key)))

describe('PhotoLoupe fullscreen button', () => {
	// spec: LOUPE-001.10
	it('is hidden where the browser has no element fullscreen', async () => {
		stubDocument({ fullscreenEnabled: false })
		const { wrapper } = await mountLoupe()
		expect(button(wrapper, 'Enter fullscreen').exists()).toBe(false)
	})

	// spec: LOUPE-001.10
	it('toggles fullscreen on the loupe and follows the browser, also when it leaves by Escape', async () => {
		stubDocument({ fullscreenEnabled: true })
		const { wrapper, root, fullscreen } = await mountLoupe()
		await button(wrapper, 'Enter fullscreen').trigger('click')
		expect(fullscreen).toEqual([root.element])
		stubDocument({ fullscreenElement: root.element })
		document.dispatchEvent(new Event('fullscreenchange'))
		await wrapper.vm.$nextTick()
		expect(button(wrapper, 'Leave fullscreen').exists()).toBe(true)
		Reflect.deleteProperty(document, 'fullscreenElement')
		document.dispatchEvent(new Event('fullscreenchange'))
		await wrapper.vm.$nextTick()
		expect(button(wrapper, 'Enter fullscreen').exists()).toBe(true)
	})

	// spec: LOUPE-001.10
	it('shows the button by the webkit flag and follows the webkit event', async () => {
		stubDocument({ webkitFullscreenEnabled: true })
		const { wrapper, root } = await mountLoupe()
		stubDocument({ webkitFullscreenElement: root.element })
		document.dispatchEvent(new Event('webkitfullscreenchange'))
		await wrapper.vm.$nextTick()
		expect(button(wrapper, 'Leave fullscreen').exists()).toBe(true)
	})

	// spec: LOUPE-001.10
	it('keeps Pick working in fullscreen', async () => {
		stubDocument({ fullscreenEnabled: true, fullscreenElement: document.body })
		const { wrapper, root } = await mountLoupe()
		await root.trigger('keydown', { key: 'p' })
		expect(wrapper.emitted('decide')?.[0]?.[0]).toEqual({ kind: 'flag', flag: 'picked' })
	})
})
