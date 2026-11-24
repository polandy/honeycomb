// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ImmichState from '../../../src/components/ImmichState.vue'

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' }
const OK = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 } as const

enableAutoUnmount(afterEach)

const button = (wrapper: ReturnType<typeof mount>, name: string) => wrapper.findAll('button').find((each) => each.text() === name)

describe('ImmichState', () => {
	// spec: IMMICH-001.18
	it('says Immich is unavailable because of the server configuration', () => {
		const wrapper = mount(ImmichState, { props: { connection: null, status: null } })

		expect(wrapper.text()).toContain('Immich is unavailable because of the server configuration')
		expect(wrapper.text()).toContain('Your Nextcloud folders work as before.')
		expect(wrapper.findAll('button')).toHaveLength(0)
	})

	// spec: IMMICH-001.19
	it('names a state that does not work, keeps the decisions and tries again', async () => {
		const wrapper = mount(ImmichState, { props: { connection: PHONE, status: { ...OK, state: 'unreachable' } } })

		expect(wrapper.text()).toContain('Immich unreachable')
		expect(wrapper.text()).toContain('Decisions already made stay in honeycomb.')
		await button(wrapper, 'Try again')!.trigger('click')

		expect(wrapper.emitted('retry')).toHaveLength(1)
	})

	// spec: IMMICH-001.26
	it('says what to do and links the admin page for each state that does not work', () => {
		for (const [state, todo, anchor] of [
			['unreachable', 'Try again in a moment', '#immich-unreachable'],
			['refused', 'Ask your admin to replace the API key', '#the-api-key-is-refused'],
			['key', 'key file', '#the-api-key-cannot-be-read'],
			['version', 'not supported', '#this-immich-version-is-not-supported'],
		] as const) {
			const wrapper = mount(ImmichState, { props: { connection: PHONE, status: { ...OK, state } } })

			expect(wrapper.text()).toContain(todo)
			expect(wrapper.find('a').attributes('href')).toMatch(new RegExp(`/docs/user/admin/immich\\.md${anchor}$`))
			wrapper.unmount()
		}
	})

	// spec: IMMICH-001.26
	it('makes Try again primary only while Immich is unreachable', () => {
		const variantOf = (state: 'unreachable' | 'refused' | 'key' | 'version') => {
			const wrapper = mount(ImmichState, { props: { connection: PHONE, status: { ...OK, state } } })
			const primary = wrapper.findAll('button').filter((each) => each.classes().includes('button-vue--primary')).map((each) => each.text())
			wrapper.unmount()
			return primary
		}

		expect(variantOf('unreachable')).toEqual(['Try again'])
		for (const state of ['refused', 'key', 'version'] as const) {
			expect(variantOf(state)).toEqual(['Connection details'])
		}
	})

	// spec: IMMICH-001.18, IMMICH-001.26
	it('links the admin page when the connections file is broken', () => {
		const wrapper = mount(ImmichState, { props: { connection: null, status: null } })

		expect(wrapper.find('a').attributes('href')).toMatch(/\/docs\/user\/admin\/immich\.md#the-connections-file$/)
	})

	it('shows the connection while it checks and once it works, with its details', async () => {
		const wrapper = mount(ImmichState, { props: { connection: PHONE, status: null } })
		expect(wrapper.text()).toContain('Checking the connection…')

		await wrapper.setProps({ status: OK })
		expect(wrapper.text()).toContain('Connected as andy')
		expect(wrapper.text()).toContain('Immich 2.3.1 · 3,660 phone uploads')
		await button(wrapper, 'Connection details')!.trigger('click')

		expect(wrapper.emitted('details')).toHaveLength(1)
	})
})
