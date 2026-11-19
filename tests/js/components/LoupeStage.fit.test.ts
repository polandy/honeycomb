// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LoupeStage from '../../../src/components/LoupeStage.vue'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'

describe('LoupeStage fit', () => {
	// spec: LOUPE-001.18
	it('raises data-fit-seq with every fit, in the render that sizes the photos', async () => {
		let resize = (_width: number, _height: number) => undefined as void
		const wrapper = mount(LoupeStage, {
			props: {
				pictures: picturesOf([listingEntry(1, '/P/IMG_1.JPG', { width: 3000, height: 2000 })]),
				index: 0,
				imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
				load: async () => undefined,
				ready: new Set<string>(),
				devicePixelRatio: 1,
				observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
					resize = onSize
					onSize(1000, 600)
					return () => undefined
				},
			},
		})
		await wrapper.vm.$nextTick()
		const stage = wrapper.find('.loupe-stage')
		expect(stage.attributes('data-fit-seq')).toBe('1')
		expect(wrapper.find('img').attributes('style')).toContain('width: 900px; height: 600px')

		resize(300, 600)
		await wrapper.vm.$nextTick()

		expect(stage.attributes('data-fit-seq')).toBe('2')
		expect(wrapper.find('img').attributes('style')).toContain('width: 300px; height: 200px')
	})

	// spec: LOUPE-001.18
	it('does not count an observer callback that reports the same size', async () => {
		let resize = (_width: number, _height: number) => undefined as void
		const wrapper = mount(LoupeStage, {
			props: {
				pictures: picturesOf([listingEntry(1, '/P/IMG_1.JPG', { width: 3000, height: 2000 })]),
				index: 0,
				imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
				load: async () => undefined,
				ready: new Set<string>(),
				devicePixelRatio: 1,
				observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
					resize = onSize
					onSize(1000, 600)
					return () => undefined
				},
			},
		})
		resize(1000, 600)
		await wrapper.vm.$nextTick()

		expect(wrapper.find('.loupe-stage').attributes('data-fit-seq')).toBe('1')
	})
})
