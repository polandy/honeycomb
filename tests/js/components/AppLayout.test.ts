// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppLayout from '../../../src/components/AppLayout.vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import { fakeStorage, provideSkipActions } from '../app-cull.ts'

enableAutoUnmount(afterEach)

describe('AppLayout', () => {
	// spec: APP-001.25
	it('always shows the navigation beside the content, handing it what the page gives', async () => {
		const openSettings = vi.fn()
		provideSkipActions()
		const wrapper = mount(AppLayout, {
			attrs: { items: [], storage: fakeStorage(), page: 'similarity', onOpenSettings: openSettings },
			slots: { default: '<p class="content">Page</p>', outside: '<p class="outside">Tip</p>' },
		})

		const navigation = wrapper.findComponent(AppNavigation)
		expect(navigation.props('page')).toBe('similarity')
		expect(wrapper.find('.app-content .content').exists()).toBe(true)
		expect(wrapper.find('.app-content .outside').exists()).toBe(false)
		expect(wrapper.find('.outside').exists()).toBe(true)
		navigation.vm.$emit('openSettings')
		expect(openSettings).toHaveBeenCalledOnce()
	})
	// spec: APP-001.27
	it('marks its root settled only when told so', async () => {
		provideSkipActions()
		const wrapper = mount(AppLayout, { props: { items: [], storage: fakeStorage(), settled: false } })
		expect(wrapper.attributes('data-settled')).toBeUndefined()

		await wrapper.setProps({ settled: true })

		expect(wrapper.attributes('data-settled')).toBe('true')
	})
})
