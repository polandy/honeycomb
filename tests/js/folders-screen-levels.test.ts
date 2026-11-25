// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { chip, crumbs, fakeList, MARK, mountScreen, names, row_, showAll } from './folders-screen-fixture.ts'
import { installMarkedCatalogue, uninstallMarkedCatalogue, untranslatedText } from './l10n/marked-catalogue.ts'
import { doneRow, row } from './logic/folder-fixtures.ts'

const decided = { picked: 0, rejected: 0 }
const Y2024 = row({ fileId: 10, path: '/Photos/2024', photos: 37, undecided: 37, ...decided })
const JURA = row({ fileId: 11, path: '/Photos/2024/Jura', photos: 3, picked: 1, rejected: 1, undecided: 1 })
const DAY1 = row({ fileId: 12, path: '/Photos/2024/Iceland/Day 1', photos: 2, picked: 1, rejected: 0, undecided: 1 })
const DAY2 = doneRow({ fileId: 13, path: '/Photos/2024/Iceland/Day 2', photos: 4, picked: 4 }, 4)
const DAY3 = row({ fileId: 14, path: '/Photos/2024/Iceland/Day 3', photos: 1, undecided: 1, ...decided })
const RECEIPTS = row({ fileId: 15, path: '/Photos/Documents/Receipts', photos: 0, undecided: 0, ...decided })
const SCANS = row({ fileId: 16, path: '/Photos/Archive/Analog/Scans 1998' })
const ROWS = [Y2024, JURA, DAY1, DAY2, DAY3, RECEIPTS, SCANS]

/** Opens the level of the row labelled `label` by its *Open* button. */
async function open(wrapper: ReturnType<typeof mountScreen>, label: string) {
	await wrapper.find(`[aria-label="${MARK}Open ${label}"]`).trigger('click')
}

describe('FoldersScreen levels', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		document.body.replaceChildren()
	})

	// spec: FOLDERS-009.2, FOLDERS-009.3
	it('starts in the only root, shows no folder without photos and a chain as one row that opens its last level', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await showAll(wrapper)

		expect(crumbs(wrapper)).toEqual(['Photos'])
		expect(names(wrapper)).toEqual(['2024', 'Archive / Analog / Scans 1998'])
		expect(wrapper.text()).not.toContain('Documents')
		expect(wrapper.text()).not.toContain('Receipts')

		await row_(wrapper, 'Archive / Analog / Scans 1998').find('.folder-row__split').trigger('click')

		expect(crumbs(wrapper)).toEqual(['Photos', 'Archive', 'Analog', 'Scans 1998'])
		expect(wrapper.find('[aria-current="location"]').text()).toBe('Scans 1998')
	})

	// spec: FOLDERS-009.1
	it('shows a level without photos of its own with ›, without Cull when the switch is off and with its subtree when on', async () => {
		const wrapper = mountScreen(fakeList(ROWS), ['/Photos'], null, false)
		await showAll(wrapper)
		await open(wrapper, '2024')
		const iceland = () => row_(wrapper, 'Iceland')

		expect(iceland().text()).toContain(`${MARK}${MARK}No photos of its own · 3 subfolders`)
		expect(iceland().find('.folder-row__cull').exists()).toBe(false)
		expect(iceland().find(`[aria-label="${MARK}Open Iceland"]`).exists()).toBe(true)

		await wrapper.setProps({ includeSubfolders: true })

		expect(iceland().text()).toContain(`${MARK}${MARK}7 photos`)
		expect(iceland().text()).toContain(`${MARK}${MARK}3 folders`)
		expect(iceland().text()).toContain(`${MARK}${MARK}1 of 3 folders done`)
		expect(iceland().find('.folder-row__cull').attributes('aria-label')).toBe(`${MARK}Cull Iceland`)
		expect(untranslatedText(wrapper.element)).toEqual([])
	})

	// spec: FOLDERS-009.6, FOLDERS-009.7
	it('culls a row with its subtree when the switch is on, without when off, and counts each pair once', async () => {
		const sardinia = row({ fileId: 20, path: '/Photos/2023/Sardinia', photos: 3, undecided: 3, ...decided })
		const drone = row({ fileId: 21, path: '/Photos/2023/Sardinia/Drone', photos: 2, undecided: 2, ...decided })
		const corsica = row({ fileId: 22, path: '/Photos/2023/Corsica' })
		const wrapper = mountScreen(fakeList([sardinia, drone, corsica]))
		await showAll(wrapper)
		await open(wrapper, '2023')

		expect(row_(wrapper, 'Sardinia').text()).toContain(`${MARK}${MARK}5 photos`)
		await row_(wrapper, 'Sardinia').find('.folder-row__cull').trigger('click')
		await wrapper.setProps({ includeSubfolders: false })
		expect(row_(wrapper, 'Sardinia').text()).toContain(`${MARK}${MARK}3 photos`)
		await row_(wrapper, 'Sardinia').find('.folder-row__cull').trigger('click')

		expect(wrapper.emitted('cull')).toEqual([
			[{ paths: ['/Photos/2023/Sardinia'], subfolders: true }],
			[{ paths: ['/Photos/2023/Sardinia'], subfolders: false }],
		])
	})

	// spec: FOLDERS-009.6
	it('culls a row without subfolders with photos as the folder alone, whatever the switch', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await showAll(wrapper)
		await open(wrapper, '2024')

		await row_(wrapper, 'Jura').find('.folder-row__cull').trigger('click')

		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/2024/Jura'], subfolders: false }]])
	})

	// spec: FOLDERS-009.8
	it('lists Photos directly in the level with its own photos and status, culling them alone, with the switch on and off', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await showAll(wrapper)
		await open(wrapper, '2024')
		const own = () => row_(wrapper, `${MARK}Photos directly in 2024`)

		for (const includeSubfolders of [true, false]) {
			await wrapper.setProps({ includeSubfolders })
			expect(names(wrapper)[0]).toBe(`${MARK}Photos directly in 2024`)
			expect(own().text()).toContain(`${MARK}${MARK}37 photos`)
			expect(own().text()).toContain(`${MARK}100 % undecided`)
			expect(own().find(`[aria-label^="${MARK}Open"]`).exists()).toBe(false)
		}
		await own().find('.folder-row__cull').trigger('click')

		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/2024'], subfolders: false }]])
	})

	it('shows the level card with the photos with subfolders, directly in it, the undecided, and culls the level in the switch\'s scope', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await showAll(wrapper)
		await open(wrapper, '2024')
		const card = wrapper.find('.folder-level-card')

		expect(card.find('.folder-level-card__name').text()).toBe('2024')
		expect(card.text()).toContain(`${MARK}${MARK}47 photos with subfolders · ${MARK}${MARK}37 directly in it · ${MARK}40 undecided`)
		expect(card.find('button').text()).toBe(`${MARK}Cull this level (with subfolders)`)
		await card.find('button').trigger('click')
		await wrapper.setProps({ includeSubfolders: false })
		expect(card.find('button').text()).toBe(`${MARK}Cull this level`)
		await card.find('button').trigger('click')

		expect(wrapper.emitted('cull')).toEqual([[{ paths: ['/Photos/2024'], subfolders: true }], [{ paths: ['/Photos/2024'], subfolders: false }]])
	})

	it('disables Cull this level on a level without photos of its own when the switch is off', async () => {
		const wrapper = mountScreen(fakeList(ROWS), ['/Photos'], null, false)
		await showAll(wrapper)
		await open(wrapper, '2024')
		await open(wrapper, 'Iceland')

		expect(wrapper.find('.folder-level-card').text()).not.toContain('directly in it')
		expect(wrapper.find('.folder-level-card button').attributes('disabled')).toBeDefined()
	})

	// spec: FOLDERS-009.9
	it('derives the state of a subtree: k of n rateable folders done, read-only in neither, then done in all', async () => {
		const open5 = [1, 2, 3, 4, 5].map((index) => row({ fileId: index, path: `/Photos/Trip/Day ${index}` }))
		const readOnly = row({ fileId: 6, path: '/Photos/Trip/Shared', permissions: 1 })
		const done = (each: typeof open5[number]) => doneRow({ fileId: each.fileId, path: each.path })
		const list = fakeList([done(open5[0]!), done(open5[1]!), ...open5.slice(2), readOnly])
		const wrapper = mountScreen(list)
		await showAll(wrapper)

		expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}${MARK}2 of 5 folders done`)
		expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}${MARK}6 folders`)

		list.rows.value = [...open5.map(done), readOnly]
		await nextTick()

		expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}${MARK}Done · all 5 folders`)
		expect(row_(wrapper, 'Trip').find('.folder-row__cull').exists()).toBe(false)
	})

	it('reads a complete subtree as not marked done and one of read-only folders as read-only', async () => {
		const complete = [1, 2, 3].map((index) => row({ fileId: index, path: `/Photos/Trip/Day ${index}`, undecided: 0, picked: 80 }))
		const shared = [4, 5].map((index) => row({ fileId: index, path: `/Photos/Shared/Day ${index}`, permissions: 1 }))
		const wrapper = mountScreen(fakeList([doneRow({ fileId: 1, path: '/Photos/Trip/Day 1' }), ...complete.slice(1), ...shared]))
		await showAll(wrapper)

		expect(row_(wrapper, 'Trip').text()).toContain(`${MARK}${MARK}Complete · 2 folders not marked done`)
		expect(row_(wrapper, 'Shared').text()).toContain(`${MARK}Read-only`)
		expect(row_(wrapper, 'Shared').find('.folder-row__cull').exists()).toBe(false)
	})

	// spec: FOLDERS-009.4
	it('shortens a deep breadcrumb to the first, a gap and the last two, and opens a level from it', async () => {
		const paths = ['/Photos/a/b/c/d/e/f', '/Photos/a/b/c/d/e/g', '/Photos/a/b/c/d/e2', '/Photos/a/x']
		const wrapper = mountScreen(fakeList(paths.map((path, index) => row({ fileId: index + 1, path }))))
		await showAll(wrapper)
		await open(wrapper, 'a')
		await open(wrapper, 'b / c / d')
		await open(wrapper, 'e')

		expect(crumbs(wrapper)).toEqual(['Photos', `${MARK}More levels`, 'd', 'e'])
		await wrapper.find(`[aria-label="${MARK}More levels"]`).trigger('click')
		expect(wrapper.findAll('.folder-breadcrumb__between button').map((each) => each.text())).toEqual(['a', 'b', 'c'])
		await wrapper.findAll('.folder-breadcrumb__between button')[1]!.trigger('click')

		expect(crumbs(wrapper)).toEqual(['Photos', 'a', 'b'])
		await wrapper.findAll('.folder-breadcrumb__crumb')[0]!.trigger('click')
		expect(crumbs(wrapper)).toEqual(['Photos'])
	})

	// spec: FOLDERS-009.4
	it('starts at the Library with several roots, lists the roots in All and leads the breadcrumb with Library', async () => {
		const camera = row({ fileId: 30, root: '/Camera', path: '/Camera' })
		const wrapper = mountScreen(fakeList([...ROWS, camera]), ['/Photos', '/Camera', '/Empty'])
		await showAll(wrapper)

		expect(crumbs(wrapper)).toEqual([`${MARK}Library`])
		expect(wrapper.find('.folder-level-card').exists()).toBe(false)
		expect(names(wrapper)).toEqual(['/Photos', '/Camera'])

		await open(wrapper, '/Photos')
		expect(crumbs(wrapper)).toEqual([`${MARK}Library`, 'Photos'])
		expect(wrapper.find('.page-title-row__title').text()).toBe('/Photos')
		await wrapper.findAll('.folder-breadcrumb__crumb')[0]!.trigger('click')
		expect(names(wrapper)).toEqual(['/Photos', '/Camera'])
	})

	// spec: FOLDERS-009.14
	it('lists every folder below the level flat in Suggested, labelled below the level, and hides Sort for All', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		await showAll(wrapper)
		await open(wrapper, '2024')
		expect(wrapper.find('select').exists()).toBe(false)

		await chip(wrapper, 'Filter', 'Suggested').trigger('click')

		expect(names(wrapper).sort()).toEqual(['2024', 'Day 1', 'Day 3', 'Jura'])
		expect(row_(wrapper, 'Day 1').find('.folder-row__parent').text()).toBe('Iceland')
		expect(row_(wrapper, 'Jura').find('.folder-row__parent').exists()).toBe(false)
		expect(chip(wrapper, 'Filter', 'Suggested').text()).toContain('4')
		expect(chip(wrapper, 'Filter', 'All').text()).toContain('5')
		expect(wrapper.find('select').exists()).toBe(true)
	})

	// spec: FOLDERS-009.22
	it('opens on All and shows All again on a level opened by the breadcrumb', async () => {
		const wrapper = mountScreen(fakeList(ROWS))
		expect(chip(wrapper, 'Filter', 'All').attributes('aria-pressed')).toBe('true')
		expect(names(wrapper)).toEqual(['2024', 'Archive / Analog / Scans 1998'])

		await open(wrapper, '2024')
		await chip(wrapper, 'Filter', 'New photos').trigger('click')
		await wrapper.findAll('.folder-breadcrumb__crumb')[0]!.trigger('click')

		expect(crumbs(wrapper)).toEqual(['Photos'])
		expect(chip(wrapper, 'Filter', 'All').attributes('aria-pressed')).toBe('true')
		expect(names(wrapper)).toEqual(['2024', 'Archive / Analog / Scans 1998'])
	})

	// spec: FOLDERS-009.16
	it('keeps the level, filter and sort while a cull hides the list', async () => {
		const list = fakeList(ROWS)
		const wrapper = mountScreen(list)
		await showAll(wrapper)
		await open(wrapper, '2024')
		await chip(wrapper, 'Filter', 'Suggested').trigger('click')
		await wrapper.find('select').setValue('largest')

		list.shown.value = false
		await nextTick()
		list.shown.value = true
		await nextTick()

		expect(crumbs(wrapper)).toEqual(['Photos', '2024'])
		expect(chip(wrapper, 'Filter', 'Suggested').attributes('aria-pressed')).toBe('true')
		expect((wrapper.find('select').element as HTMLSelectElement).value).toBe('largest')
	})

	it('goes back to the start when the shown level is gone from the rows', async () => {
		const list = fakeList(ROWS)
		const wrapper = mountScreen(list)
		await showAll(wrapper)
		await open(wrapper, '2024')

		list.rows.value = [SCANS]
		await nextTick()

		expect(crumbs(wrapper)).toEqual(['Photos'])
	})

	// spec: FOLDERS-009.5
	it('asks to turn the switch Include subfolders off', async () => {
		const wrapper = mountScreen(fakeList(ROWS))

		await wrapper.find('.folders-screen__subfolders input').setValue(false)

		expect(wrapper.emitted('update:includeSubfolders')).toEqual([[false]])
	})
})
