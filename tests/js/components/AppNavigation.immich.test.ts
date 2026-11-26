// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import AppNavigation from '../../../src/components/AppNavigation.vue'
import RecentFolderSets from '../../../src/components/RecentFolderSets.vue'
import { fakeStorage } from '../app-cull.ts'

vi.mock('@nextcloud/vue/composables/useIsMobile', () => ({ useIsMobile: () => ref(false) }))

const LINES = [
	{ id: 'andy-phone', label: 'Andy · Phone', line: 'Connected as andy', working: true },
	{ id: 'kids', label: 'Kids', line: 'Immich unreachable', working: false },
]

enableAutoUnmount(afterEach)

function mountNavigation(props: Record<string, unknown> = {}) {
	return mount(AppNavigation, { props: { items: [], storage: fakeStorage(), offersImmich: true, ...props } })
}

const button = (wrapper: ReturnType<typeof mountNavigation>, name: string) => wrapper.findAll('a, button').find((each) => each.text().startsWith(name))!

describe('AppNavigation: the sources', () => {
	// spec: IMMICH-001.1
	it('has no source switcher without Immich', () => {
		const wrapper = mountNavigation({ offersImmich: false })

		expect(wrapper.find('[role="group"]').exists()).toBe(false)
	})

	it('switches between Nextcloud and Immich, the shown source pressed', async () => {
		const wrapper = mountNavigation()
		const switcher = wrapper.get('[role="group"]')
		expect(switcher.attributes('aria-label')).toBe('Source')
		expect(switcher.findAll('button').map((each) => [each.text(), each.attributes('aria-pressed')])).toEqual([['Nextcloud', 'true'], ['Immich', 'false']])

		await switcher.findAll('button')[1]!.trigger('click')

		expect(wrapper.emitted('chooseSource')).toEqual([['immich']])
	})

	it('keeps Folder and Recent on Nextcloud and hides them on Immich', async () => {
		const wrapper = mountNavigation()
		expect(wrapper.findComponent(RecentFolderSets).exists() || wrapper.text().includes('Folder sets you cull show here.')).toBe(true)

		await wrapper.setProps({ source: 'immich', connections: LINES.slice(0, 1), connectionId: 'andy-phone' })

		expect(wrapper.text()).not.toContain('Folder sets you cull show here.')
		expect(wrapper.text()).not.toContain('Recent')
		expect(wrapper.text()).toContain('Statistics')
	})

	// spec: IMMICH-001.14
	it('lists several connections with their status and opens one', async () => {
		const wrapper = mountNavigation({ source: 'immich', connections: LINES, connectionId: 'andy-phone' })
		await nextTick()

		expect(wrapper.text()).toContain('Connected as andy')
		expect(wrapper.text()).toContain('Immich unreachable')

		await button(wrapper, 'Kids').trigger('click')

		expect(wrapper.emitted('openConnection')).toEqual([['kids']])
	})

	// spec: IMMICH-001.28
	it('marks a working, a failing and an asked connection by a tick, a cross and a dash', () => {
		const asked = { id: 'new', label: 'New', line: 'Checking the connection…', working: null }
		const wrapper = mountNavigation({ source: 'immich', connections: [...LINES, asked], connectionId: 'andy-phone' })

		const marks = wrapper.findAll('.immich-connections__mark')

		expect(marks.map((mark) => mark.attributes('data-state'))).toEqual(['working', 'failed', 'asked'])
		expect(new Set(marks.map((mark) => mark.find('path').attributes('d'))).size).toBe(3)
	})

	// spec: IMMICH-001.14
	it('lists no connections with only one', () => {
		const wrapper = mountNavigation({ source: 'immich', connections: LINES.slice(0, 1), connectionId: 'andy-phone' })

		expect(wrapper.text()).not.toContain('Andy · Phone')
		expect(wrapper.text()).not.toContain('Connections')
	})

	// spec: IMMICH-001.13
	it('opens the connection details', async () => {
		const wrapper = mountNavigation({ source: 'immich', connections: LINES.slice(0, 1), connectionId: 'andy-phone' })

		await button(wrapper, 'Connection details').trigger('click')

		expect(wrapper.emitted('connectionDetails')).toHaveLength(1)
	})

	// spec: IMMICH-003.15
	it('lists a connection under Recent without a folder set, and opens it on a tap', async () => {
		const wrapper = mountNavigation({ recentConnections: [{ connectionId: 'kids', label: 'Kids', decided: 2, total: 9 }] })
		await nextTick()

		expect(wrapper.text()).not.toContain('Folder sets you cull show here.')
		await button(wrapper, 'Kids').trigger('click')

		expect(wrapper.emitted('openRecentConnection')).toEqual([['kids']])
	})
})
