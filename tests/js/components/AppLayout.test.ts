// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import AppLayout from '../../../src/components/AppLayout.vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import { fakeStorage } from '../app-cull.ts'

enableAutoUnmount(afterEach)

describe('AppLayout', () => {
	// spec: APP-001.23
	it('always shows the navigation beside the content, handing it what the page gives', async () => {
		const wrapper = mount(AppLayout, {
			props: { items: [], storage: fakeStorage(), page: 'similarity' },
			slots: { default: '<p class="content">Page</p>', outside: '<p class="outside">Tip</p>' },
		})

		const navigation = wrapper.findComponent(AppNavigation)
		expect(navigation.props('page')).toBe('similarity')
		expect(wrapper.find('.app-content .content').exists()).toBe(true)
		expect(wrapper.find('.app-content .outside').exists()).toBe(false)
		expect(wrapper.find('.outside').exists()).toBe(true)
		navigation.vm.$emit('openSettings')
		expect(wrapper.emitted('openSettings')).toEqual([[]])
	})
})
