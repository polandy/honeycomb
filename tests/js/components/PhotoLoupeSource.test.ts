// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { immichSource } from '../../../src/logic/opened-source.ts'
import { button, mountLoupe } from './mount-loupe.ts'

const DECISIONS_ONLY = immichSource('andy-phone').capabilities

describe('PhotoLoupe on a source that only decides', () => {
	// spec: IMMICH-002.17
	it('offers no move, tags, Keep RAW, series or folder, and their keys do nothing', async () => {
		const { wrapper } = await mountLoupe(4, {}, false, { capabilities: DECISIONS_ONLY, folderSet: undefined })
		wrapper.vm.hotkeys.info!()
		await wrapper.vm.$nextTick()

		expect(button(wrapper, 'Move this photo').exists()).toBe(false)
		expect(button(wrapper, 'Tags').exists()).toBe(false)
		expect(wrapper.find('button[aria-label^="Keep RAW"]').exists()).toBe(false)
		expect(wrapper.find('.loupe-info').text()).not.toContain('Folder')
		expect(wrapper.vm.hotkeys).not.toHaveProperty('tag')
		expect(wrapper.vm.hotkeys).not.toHaveProperty('compare')
		expect(wrapper.vm.hotkeys).not.toHaveProperty('pick-rest')
	})

	// spec: IMMICH-002.9, IMMICH-002.27
	it('counts the shown picture against the server\'s total, or the total alone while the offset is unknown', async () => {
		const { wrapper } = await mountLoupe(4, {}, false, { counter: { position: 91, total: 1000 } })
		expect(wrapper.find('.loupe-title-row__count').text()).toBe('91 / 1,000')

		await wrapper.setProps({ counter: { position: null, total: 1000 } })
		expect(wrapper.find('.loupe-title-row__count').text()).toBe('1,000 photos')
	})
})
