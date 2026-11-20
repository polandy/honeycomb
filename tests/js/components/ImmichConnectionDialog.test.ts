// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ConnectionStatus } from '../../../src/logic/immich-connections.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ImmichConnectionDialog from '../../../src/components/ImmichConnectionDialog.vue'

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example' }
const OK: ConnectionStatus = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 }

enableAutoUnmount(afterEach)

/** The dialog in the page body, where NcDialog renders it. */
function mountDialog(status: typeof OK | null = OK) {
	const wrapper = mount(ImmichConnectionDialog, { props: { connection: PHONE, status }, attachTo: document.body })
	const text = () => document.body.textContent ?? ''
	const button = (name: string) => [...document.body.querySelectorAll('button')].find((each) => each.textContent?.trim() === name)
	return { wrapper, text, button }
}

describe('ImmichConnectionDialog', () => {
	// spec: IMMICH-001.13
	it('shows the connection read only: label, URL, status, account, version, uploads, scopes and the admin note', () => {
		const { text } = mountDialog()

		for (const shown of ['Immich connection', 'Andy · Phone', 'https://immich.example', 'Connected as andy', '2.3.1', '3,660', 'asset.read', 'asset.view', 'asset.statistics', 'user.read', 'Your Nextcloud admin sets up the Immich connections.']) {
			expect(text()).toContain(shown)
		}
		expect(document.body.querySelectorAll('input, textarea, select')).toHaveLength(0)
		expect(text()).not.toMatch(/key file|api key:/i)
	})

	// spec: IMMICH-001.10, IMMICH-001.17
	it('says what the key may not read', () => {
		const { text } = mountDialog({ ...OK, account: null, total: null })

		expect(text()).toContain('not shown, the key lacks user.read')
		expect(text()).not.toContain('Connected as')
	})

	// spec: IMMICH-001.11
	it('says an unsupported version', () => {
		const { text } = mountDialog({ ...OK, state: 'version', version: '1.90.0' })

		expect(text()).toContain('1.90.0 · not supported')
		expect(text()).toContain('This Immich version is not supported')
	})

	// spec: IMMICH-001.13
	it('asks the status again on Test connection and shows its result, Done closes it', async () => {
		const { wrapper, text, button } = mountDialog(null)
		expect(text()).toContain('Checking the connection…')

		button('Test connection')!.click()
		await flushPromises()
		expect(wrapper.emitted('test')).toHaveLength(1)
		await wrapper.setProps({ status: { ...OK, state: 'refused' } })
		expect(document.body.querySelector('[role="alert"]')?.textContent).toContain('The API key is refused')

		button('Done')!.click()
		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
