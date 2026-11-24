// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FolderCover from '../../src/components/FolderCover.vue'

const imageUrl = (fileId: number | string, size: number, mtime: number) => `/p/${fileId}/${size}/${mtime}`
const PREVIEWS = [{ fileId: 1, mtime: 11 }, { fileId: 2, mtime: 22 }, { fileId: 3, mtime: 33 }]

function cover(count: number, done = false) {
	return mount(FolderCover, { props: { previews: PREVIEWS.slice(0, count), done, imageUrl } })
}

describe('FolderCover', () => {
	// spec: FOLDERS-007.18
	it('shows a lazy thumbnail of the small tier for each preview', () => {
		const images = cover(3).findAll('img')

		expect(images.map((each) => each.attributes('src'))).toEqual(['/p/1/256/11', '/p/2/256/22', '/p/3/256/33'])
		expect(images.every((each) => each.attributes('loading') === 'lazy' && each.attributes('alt') === '')).toBe(true)
	})

	// spec: FOLDERS-007.18
	it('lays out one, two and three previews differently', () => {
		expect([1, 2, 3].map((count) => cover(count).classes())).toEqual([
			expect.arrayContaining(['folder-cover--1']),
			expect.arrayContaining(['folder-cover--2']),
			expect.arrayContaining(['folder-cover--3']),
		])
	})

	// spec: FOLDERS-007.18
	it('shows the folder icon without previews and the check icon when done', () => {
		expect(cover(0).find('img').exists()).toBe(false)
		expect(cover(0).find('.folder-cover__icon').exists()).toBe(true)
		expect(cover(0).find('svg').html()).not.toBe(cover(0, true).find('svg').html())
	})

	// spec: FOLDERS-007.18
	it('drops a preview that fails and shows the icon once all failed', async () => {
		const wrapper = cover(3)
		await wrapper.findAll('img')[1]!.trigger('error')

		expect(wrapper.findAll('img').map((each) => each.attributes('src'))).toEqual(['/p/1/256/11', '/p/3/256/33'])
		expect(wrapper.classes()).toContain('folder-cover--2')

		for (const image of wrapper.findAll('img')) {
			await image.trigger('error')
		}
		expect(wrapper.find('img').exists()).toBe(false)
		expect(wrapper.find('.folder-cover__icon').exists()).toBe(true)
	})

	// spec: FOLDERS-007.18
	it('keeps a check mark over the cover of a done folder', () => {
		expect(cover(2, true).find('.folder-cover__done').exists()).toBe(true)
		expect(cover(2).find('.folder-cover__done').exists()).toBe(false)
	})
})
