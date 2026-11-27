// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import FoldersProgress from '../../../src/components/FoldersProgress.vue'
import { folderProgress } from '../../../src/logic/folder-progress.ts'
import { doneRow, row } from '../logic/folder-fixtures.ts'

const NOW = new Date(Date.UTC(2026, 10, 20))
const PROGRESS = folderProgress([doneRow({ path: '/Photos/a' }), row({ root: '/Archive', path: '/Archive/b' })], ['/Photos', '/Archive'], NOW)

describe('FoldersProgress', () => {
	// spec: FOLDERS-003.2
	it('shows a bar per root of the whole library under its title', () => {
		const wrapper = mount(FoldersProgress, { props: { root: null, roots: 2, progress: PROGRESS.total, perRoot: PROGRESS.perRoot } })

		expect(wrapper.find('.folders-progress__name').text()).toBe('Library')
		expect(wrapper.find('.folders-progress__name').attributes('translate')).toBeUndefined()
		expect(wrapper.findAll('.folders-progress__root').map((each) => each.text())).toEqual([expect.stringMatching(/^\/Photos\s*100 %$/), expect.stringMatching(/^\/Archive\s*0 %$/)])
	})

	// spec: FOLDERS-003.2
	it('names a chosen root without bars, and leaves the title out where the page shows it', () => {
		const chosen = mount(FoldersProgress, { props: { root: '/Photos', roots: 2, progress: PROGRESS.perRoot[0]!.progress, perRoot: [] } })
		expect(chosen.find('.folders-progress__name').attributes('translate')).toBe('no')
		expect(chosen.find('.folders-progress__roots').exists()).toBe(false)

		const untitled = mount(FoldersProgress, { props: { root: null, roots: 1, progress: PROGRESS.total, perRoot: [], titled: false } })
		expect(untitled.find('.folders-progress__head').exists()).toBe(false)
		expect(untitled.find('.folders-progress__headline').text()).toBe('50 % of photos in done folders')
	})
})
