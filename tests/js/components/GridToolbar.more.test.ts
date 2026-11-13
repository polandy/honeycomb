// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { mountToolbar } from './grid-toolbar-mount.ts'
import { PopoverStub } from './stubs.ts'

const MARK = TRANSLATED_MARK

describe('GridToolbar More menu', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(uninstallMarkedCatalogue)

	// spec: GRID-001.17
	it.each([['Review rejects', 'rejected', 'reviewRejects'], ['Compare series', 'series', 'compareSeries']] as const)('keeps %s in the toolbar from 900 px and in the More menu below, with its count, held at 0', async (label, count, event) => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('.grid-more-menu__narrow').find((button) => button.text().includes(label))!
		const wrapper = mountToolbar(set, 1, { [count]: 4 })

		expect(wrapper.find(`[aria-label*="${label}"]`).classes()).toContain('grid-toolbar__wide')
		expect(item(mountToolbar(set)).attributes('disabled')).toBeDefined()
		expect(item(wrapper).text().replaceAll(MARK, '')).toBe(`${label} 4`)
		await item(wrapper).trigger('click')
		expect(wrapper.emitted(event)).toHaveLength(1)
	})

	it('removes RAWs from the More menu with their count, held while there are none', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Remove RAWs'))!
		const none = item(mountToolbar(set))
		const wrapper = mountToolbar(set, 1, { rawRemovable: 88 })

		expect(none.attributes('disabled')).toBeDefined()
		expect(item(wrapper).text().replaceAll(MARK, '')).toBe('Remove RAWs… 88')
		await item(wrapper).trigger('click')
		expect(wrapper.emitted('removeRaws')).toHaveLength(1)
	})

	// spec: DECISIONS-002.7
	it('resumes at the stored picture from the More menu, shown only while there is one', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Resume'))
		const wrapper = mountToolbar(set, 1, { resumeName: 'IMG_9' })

		expect(item(mountToolbar(set))).toBeUndefined()
		expect(item(wrapper)!.text()).toBe(`${MARK}Resume at IMG_9`)
		await item(wrapper)!.trigger('click')
		expect(wrapper.emitted('resume')).toHaveLength(1)
	})

	// spec: MOVE-004.2
	it('moves the picks, or the filtered photos while a filter is on, from the More menu with their count, held at 0', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().replaceAll(MARK, '').startsWith('Move'))!
		const filtered = mountToolbar(set, 1, { movable: 5, activeFilters: 1 })

		expect(item(mountToolbar(set)).attributes('disabled')).toBeDefined()
		expect(item(mountToolbar(set, 1, { movable: 3 })).text().replaceAll(MARK, '')).toBe('Move picks… 3')
		expect(item(filtered).text().replaceAll(MARK, '')).toBe('Move filtered… 5')
		await item(filtered).trigger('click')
		expect(filtered.emitted('move')).toHaveLength(1)
	})

	// spec: XMP-003.12
	it('offers writing to sidecars in the More menu only with photos in a shared folder', async () => {
		const set = { paths: ['/Trip'], subfolders: false }
		const item = (wrapper: ReturnType<typeof mountToolbar>) => wrapper.findAll('button').find((button) => button.text().includes('Write decisions to sidecars'))
		const wrapper = mountToolbar(set, 1, { sidecarsShared: true })

		expect(item(mountToolbar(set))).toBeUndefined()
		expect(item(wrapper)!.text().replaceAll(MARK, '')).toBe('Write decisions to sidecars…')
		await item(wrapper)!.trigger('click')
		expect(wrapper.emitted('writeSidecars')).toHaveLength(1)
	})

	it('opens the settings from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/Trip'], subfolders: false })
		const item = wrapper.findAll('button').find((button) => button.text().replaceAll(MARK, '') === 'Settings')!

		await item.trigger('click')

		expect(wrapper.emitted('openSettings')).toHaveLength(1)
	})

	// spec: GRID-001.7
	it('sets the thumbnail size from the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const range = wrapper.find(`input[type="range"][aria-label="${MARK}Thumbnail size"]`)

		expect(wrapper.find(`[aria-label="${MARK}More"]`).exists()).toBe(true)
		expect(range.attributes()).toMatchObject({ min: '90', max: '340' })
		expect((range.element as HTMLInputElement).value).toBe('150')
		await range.setValue('200')

		expect(wrapper.emitted('update:tileSize')).toEqual([[200]])
	})

	// spec: GRID-001.18
	it('sets the view options apart from the actions in the More menu by one separator', () => {
		const menu = mountToolbar({ paths: ['/A', '/B'], subfolders: false }, 2).find('.grid-more-menu')
		const separators = menu.findAll('hr, [role="separator"]')

		expect(separators).toHaveLength(1)
		expect(separators[0]!.element.previousElementSibling).toBe(menu.find('fieldset').element)
		expect(separators[0]!.element.nextElementSibling!.tagName).toBe('BUTTON')
	})

	// spec: GRID-001.18
	it.each(['Review rejects', 'Compare series', 'Remove RAWs', 'Move picks', 'Resume at', 'Write decisions to sidecars', 'Settings'])('closes the More menu when %s is chosen', async (label) => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false }, 1, { rejected: 1, series: 1, rawRemovable: 1, movable: 1, resumeName: 'IMG_9', sidecarsShared: true })
		const popover = wrapper.findComponent(PopoverStub)
		await popover.vm.$emit('update:shown', true)
		expect(popover.props('shown')).toBe(true)

		await wrapper.find('.grid-more-menu').findAll('button').find((button) => button.text().includes(label))!.trigger('click')

		expect(popover.props('shown')).toBe(false)
	})

	// spec: GRID-001.18
	it('keeps the More menu open while a view option changes', async () => {
		const wrapper = mountToolbar({ paths: ['/A', '/B'], subfolders: false }, 2)
		const popover = wrapper.findComponent(PopoverStub)
		await popover.vm.$emit('update:shown', true)

		await wrapper.find('input[type="range"]').setValue('200')
		await wrapper.find('input[type="checkbox"]').setValue(true)
		await wrapper.find('input[type="radio"][value="capture-time"]').setValue(true)

		expect(popover.props('shown')).toBe(true)
	})

	// spec: GRID-001.9
	it('offers Group by folder only when the cull spans more than one folder', async () => {
		expect(mountToolbar({ paths: ['/A'], subfolders: true }, 1).text()).not.toContain('Group by folder')
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: true }, 2)

		await wrapper.find('input[type="checkbox"]').setValue(true)

		expect(wrapper.text()).toContain(`${MARK}Group by folder`)
		expect(wrapper.emitted('update:groupByFolder')).toEqual([[true]])
	})

	// spec: GRID-002.8
	it('chooses the sort order in the More menu', async () => {
		const wrapper = mountToolbar({ paths: ['/A'], subfolders: false })
		const radios = wrapper.findAll('input[type="radio"]')

		expect(wrapper.text()).toContain(`${MARK}Sort by`)
		expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([true, false])
		await radios[1]!.setValue(true)

		expect(wrapper.text()).toContain(`${MARK}File name`)
		expect(wrapper.text()).toContain(`${MARK}Capture time`)
		expect(wrapper.emitted('update:sortOrder')).toEqual([['capture-time']])
	})
})
