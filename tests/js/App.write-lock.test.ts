// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListedAccess } from '../../src/logic/writability.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import UndoToast from '../../src/components/UndoToast.vue'
import { NO_ACCESS } from '../../src/logic/writability.ts'
import { mountApp, openCull, SET, sharedAccess, shownNames, stored } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { fakeScheduler } from './fake-scheduler.ts'

enableAutoUnmount(afterEach)

/** The app with the given stored settings on a cull of `/Trip`, the loupe open on IMG_10. */
async function openLoupe(settings: object, access: ListedAccess = NO_ACCESS, props: Record<string, unknown> = {}) {
	const mounted = mountApp({ loadSettings: async () => settings, schedule: fakeScheduler().schedule, ...props }, [], { NcDialog: DialogStub })
	await flushPromises()
	await openCull(mounted.wrapper, SET, undefined, access)
	mounted.wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(mounted.wrapper).indexOf('IMG_10'))
	await flushPromises()
	const loupe = mounted.wrapper.findComponent(PhotoLoupe)
	return { ...mounted, loupe, picture: loupe.props('pictures')[loupe.props('index')]! }
}

/** Rejects IMG_10 from the loupe. */
async function reject(opened: Awaited<ReturnType<typeof openLoupe>>) {
	opened.loupe.vm.$emit('decide', { kind: 'flag', flag: 'rejected' }, opened.picture)
	await flushPromises()
}

const dialog = (wrapper: AppWrapper) => wrapper.find('[role="dialog"]')
const button = (wrapper: AppWrapper, text: string) => dialog(wrapper).findAll('button').find((each) => each.text() === text)!
const toastMessage = (wrapper: AppWrapper) => wrapper.findComponent(UndoToast).props('toast').message
const rejected = [stored(2, 'rejected'), stored(3, 'rejected')]

describe('App: deciding needs writing', () => {
	// spec: XMP-008.7, XMP-003.18, SETTINGS-001.24
	it('asks to turn writing On at the first decision, then saves it and the decision', async () => {
		const scheduler = fakeScheduler()
		const opened = await openLoupe({}, NO_ACCESS, { schedule: scheduler.schedule })
		const { wrapper, saved, savedSettings, sidecarSaves } = opened

		await reject(opened)
		expect(dialog(wrapper).attributes('name')).toBe('Write decisions to XMP sidecars?')
		expect(dialog(wrapper).text()).toContain('IMG_0001.NEF.xmp')
		expect(saved).toEqual([])

		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		scheduler.fire()
		await flushPromises()

		expect(savedSettings.at(-1)).toMatchObject({ sidecarWrite: 'on' })
		expect(saved).toEqual([rejected])
		expect(sidecarSaves).toHaveLength(1)
		expect(dialog(wrapper).exists()).toBe(false)
	})

	// spec: XMP-008.7
	it('decides nothing and keeps writing Off on Cancel', async () => {
		const opened = await openLoupe({})
		const { wrapper, saved, savedSettings } = opened

		await reject(opened)
		await button(wrapper, 'Cancel').trigger('click')
		await flushPromises()

		expect(savedSettings).toEqual([])
		expect(saved).toEqual([])
		expect(opened.loupe.props('decisionOf')(opened.picture).flag).toBe('unflagged')
		expect(dialog(wrapper).exists()).toBe(false)
	})

	// spec: XMP-008.4, XMP-008.7
	it('asks once for a shared opened folder, remembers it, and asks no more', async () => {
		const opened = await openLoupe({ sidecarWrite: 'on' }, sharedAccess(['/Trip/A']))
		const { wrapper, saved, savedSettings } = opened

		await reject(opened)
		expect(dialog(wrapper).attributes('name')).toBe('Write to a shared folder?')
		expect(dialog(wrapper).text()).toContain('Everyone who shares Trip will see these decisions')
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()
		expect(savedSettings.at(-1)).toMatchObject({ sidecarWrite: 'on', confirmedSharedFolders: [7] })
		expect(saved).toEqual([rejected])

		opened.loupe.vm.$emit('decide', { kind: 'rating', rating: 2 }, opened.picture)
		await flushPromises()
		expect(dialog(wrapper).exists()).toBe(false)
		expect(saved).toHaveLength(2)
	})

	// spec: XMP-008.4, XMP-008.7
	it('asks writing On and the shared folder in one dialog', async () => {
		const opened = await openLoupe({}, sharedAccess(['/Trip/A']))
		const { wrapper, savedSettings } = opened

		await reject(opened)
		expect(dialog(wrapper).attributes('name')).toBe('Write decisions to XMP sidecars?')
		expect(dialog(wrapper).text()).toContain('Everyone who shares Trip will see these decisions')
		await button(wrapper, 'Write to sidecars').trigger('click')
		await flushPromises()

		expect(savedSettings).toHaveLength(1)
		expect(savedSettings[0]).toMatchObject({ sidecarWrite: 'on', confirmedSharedFolders: [7] })
	})

	// spec: SETTINGS-001.26, XMP-008.7
	it('cannot turn writing On without the Versions app and says why', async () => {
		const opened = await openLoupe({}, NO_ACCESS, { versionsApp: false })
		const { wrapper } = opened

		await reject(opened)

		expect(dialog(wrapper).text()).toContain('On needs the Versions app, so that every write can be undone; ask your administrator to enable it.')
		expect(button(wrapper, 'Write to sidecars').attributes('disabled')).toBeDefined()
	})

	// spec: XMP-008.3, XMP-008.5, XMP-008.7
	it.each([
		['read-only', { permissions: 1 }, 'Not changed: you may only read this folder'],
		['without versions', { versions: false }, 'Not changed: this folder keeps no versions'],
	])('names the reason in a toast for a %s folder and asks nothing', async (_case, change, text) => {
		const access: ListedAccess = { folders: [{ path: '/Trip/A', shared: false, permissions: 31, versions: true, ...change }], opened: [{ path: '/Trip', fileId: 7 }] }
		const opened = await openLoupe({ sidecarWrite: 'on' }, access)
		const { wrapper, saved } = opened

		await reject(opened)

		expect(dialog(wrapper).exists()).toBe(false)
		expect(toastMessage(wrapper)).toBe(text)
		expect(saved).toEqual([])
	})
})
