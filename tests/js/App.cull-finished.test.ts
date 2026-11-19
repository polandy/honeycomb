// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { StoredDecision } from '../../src/logic/decision.ts'
import type { AppWrapper } from './app-cull.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import CullFinished from '../../src/components/CullFinished.vue'
import DeleteSummary from '../../src/components/DeleteSummary.vue'
import GridToolbar from '../../src/components/GridToolbar.vue'
import PhotoGrid from '../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../src/components/PhotoLoupe.vue'
import RejectReview from '../../src/components/RejectReview.vue'
import { mountApp, openCull, shownNames, sidecarApi, stored } from './app-cull.ts'
import { DialogStub } from './components/stubs.ts'
import { listingEntry } from './logic/listing-entries.ts'
import { xmp } from './logic/sidecar-answers.ts'

/** IMG_2 of 1 kB, IMG_10 of 2 + 3 kB and IMG_9 of 4 kB. */
const SIZED = [
	listingEntry(1, '/Trip/B/IMG_2.JPG', { size: 1024 }),
	listingEntry(2, '/Trip/A/IMG_10.JPG', { size: 2048 }),
	listingEntry(3, '/Trip/A/IMG_10.CR3', { mime: 'image/x-dcraw', size: 3072 }),
	listingEntry(4, '/Trip/A/IMG_9.JPG', { size: 4096 }),
]

/** The app on a cull of SIZED with the decisions, which the JPEGs' XMP agrees with, its clock at `clock.now` and a trash endpoint that trashes every file. */
async function openApp(decisions: StoredDecision[]) {
	const clock = { now: 0 }
	const flags = new Map(decisions.map(({ fileId, flag }) => [fileId, flag]))
	const sidecars = {
		...sidecarApi(),
		lookupEmbeddedXmp: async (ids: readonly number[]) => ids.map((id) => (flags.get(id) === 'rejected' ? { result: 'read', bytes: xmp({ 'digiKam:PickLabel': '1' }) } : { result: 'none' })),
	}
	const trashPictures = async (request: { fileId: number }[][]) => request.map((files) => files.map(({ fileId }) => ({ fileId, result: 'trashed' })))
	const listEntries = async () => ({ entries: SIZED })
	const mounted = mountApp({ clock: () => clock.now, sidecars, trashPictures, listEntries }, decisions, { NcDialog: DialogStub })
	await openCull(mounted.wrapper, undefined, SIZED)
	return { ...mounted, clock }
}

/** Presses a key on the page. */
async function press(key: string, fields: KeyboardEventInit = {}) {
	document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...fields }))
	await flushPromises()
}

/** Focuses the named photo in the grid. */
function focus(wrapper: AppWrapper, grid: { focused: number }, name: string) {
	grid.focused = shownNames(wrapper).indexOf(name)
}

const card = (wrapper: AppWrapper) => wrapper.findComponent(CullFinished)
const done = async (wrapper: AppWrapper) => {
	await card(wrapper).findAll('button').find((button) => button.text() === 'Done')!.trigger('click')
	await flushPromises()
}

enableAutoUnmount(afterEach)

describe('App: Cull finished', () => {
	// spec: STATS-001.19, STATS-001.35
	it('opens once when the user decides the last undecided photo, with the session numbers, and again only after a photo became undecided', async () => {
		const { wrapper, grid, clock } = await openApp([stored(1, 'picked'), stored(2, 'rejected'), stored(3, 'rejected')])
		focus(wrapper, grid, 'IMG_9')
		clock.now = 30_000

		await press('p')

		expect(card(wrapper).exists()).toBe(true)
		const text = card(wrapper).text()
		expect(card(wrapper).find('[role=dialog]').attributes('name')).toBe('Cull finished')
		expect(text).toContain('1 photo decided')
		expect(text).toContain('Before 3 photos · 10 kB → after 3 · 10 kB')
		expect(text).toContain('Active time 0 s')
		await done(wrapper)
		expect(card(wrapper).exists()).toBe(false)

		await press('3')
		expect(card(wrapper).exists()).toBe(false)
		clock.now = 60_000
		await press('u')
		await press('p')
		expect(card(wrapper).text()).toContain('Active time 30 s')
	})

	// spec: STATS-001.32
	it('counts the photos the session changed, net of an undo, and waits while the loupe is open', async () => {
		const { wrapper } = await openApp([stored(1, 'picked')])
		wrapper.findComponent(PhotoGrid).vm.$emit('open', shownNames(wrapper).indexOf('IMG_10'))
		await flushPromises()
		const loupe = wrapper.findComponent(PhotoLoupe)
		const [img10, img9] = ['IMG_10', 'IMG_9'].map((name) => loupe.props('pictures').find((picture: { baseName: string }) => picture.baseName === name))
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'picked' }, img9)
		loupe.vm.$emit('decide', { kind: 'flag', flag: 'rejected' }, img10)
		await flushPromises()
		expect(card(wrapper).exists()).toBe(false)

		loupe.vm.$emit('close')
		await flushPromises()

		expect(card(wrapper).text()).toContain('2 photos decided')
		expect(card(wrapper).text()).toMatch(/1\s*picked/)
		expect(card(wrapper).text()).toMatch(/1\s*rejected/)
	})

	// spec: STATS-001.34
	it('does not open on a folder set that opens with no undecided photo', async () => {
		const { wrapper } = await openApp([stored(1, 'picked'), stored(2, 'picked'), stored(3, 'picked'), stored(4, 'picked')])

		expect(card(wrapper).exists()).toBe(false)
	})

	// spec: STATS-001.20, STATS-001.33
	it('opens when a delete from the reject review ends, with the photos moved and before and after', async () => {
		const { wrapper } = await openApp([stored(2, 'rejected'), stored(3, 'rejected')])
		wrapper.findComponent(GridToolbar).vm.$emit('reviewRejects')
		await flushPromises()
		wrapper.findComponent(RejectReview).vm.$emit('confirm')
		await flushPromises()
		expect(card(wrapper).exists()).toBe(false)

		wrapper.findComponent(DeleteSummary).vm.$emit('confirm')
		await flushPromises()

		const text = card(wrapper).text()
		expect(text).toContain('Before 3 photos · 10 kB → after 2 · 5 kB')
		expect(text).toMatch(/1\s*Moved to the trash bin/)
		expect(text).toContain('5 kB freed')
	})
})
