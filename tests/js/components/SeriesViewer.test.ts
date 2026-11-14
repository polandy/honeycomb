// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { DecisionIntent } from '../../../src/logic/decision-change.ts'
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { Settings } from '../../../src/logic/settings.ts'
import type { Toast } from '../../../src/toast.ts'

import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import ActionBar from '../../../src/components/ActionBar.vue'
import SeriesViewer from '../../../src/components/SeriesViewer.vue'
import { hotkeyListener } from '../../../src/hotkeys.ts'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { installMarkedCatalogue, TRANSLATED_MARK, uninstallMarkedCatalogue } from '../l10n/marked-catalogue.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'
import { pointer, tap } from './loupe-pointer.ts'

const SERIES = picturesOf([1, 2, 3].map((id) => listingEntry(id, `/Trip/IMG_${id}.JPG`, { width: 3000, height: 2000 }))) as Picture<ListingEntry>[]
const listeners: ((event: KeyboardEvent) => void)[] = []

/** The viewer at `index` of the series on a 1000 × 600 stage, its keys on the window as the app installs them. */
async function mountViewer(index = 1, settings: Partial<Settings> = {}, pictures: Picture<ListingEntry>[] = SERIES) {
	const decoded: string[] = []
	const decided: [DecisionIntent, string][] = []
	const decisions = reactive(new Map<string, Decision>())
	const scheduler = fakeScheduler()
	const wrapper = mount(SeriesViewer, {
		attachTo: document.body,
		props: {
			pictures,
			index,
			position: 1,
			count: 3,
			decisionOf: (picture: Picture<ListingEntry>) => decisions.get(picture.baseName) ?? UNDECIDED,
			settings: { ...DEFAULT_SETTINGS, ...settings },
			imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
			decode: async (src: string) => {
				decoded.push(src)
			},
			schedule: scheduler.schedule,
			devicePixelRatio: 1,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, 600)
				return () => undefined
			},
			'onUpdate:index': (next: number) => wrapper.setProps({ index: next }),
			onDecide: (intent: DecisionIntent, picture: Picture<ListingEntry>) => {
				decided.push([intent, picture.baseName])
				decisions.set(picture.baseName, { ...UNDECIDED, ...(intent.kind === 'flag' ? { flag: intent.flag } : {}) })
			},
			onUpdateSettings: (patch: Partial<Settings>) => wrapper.setProps({ settings: { ...wrapper.props('settings'), ...patch } }),
		},
	})
	const listener = hotkeyListener(() => wrapper.vm.hotkeys, () => false)
	listeners.push(listener)
	window.addEventListener('keydown', listener)
	await flushPromises()
	const root = wrapper.find('.series-viewer')
	const press = (key: string, fields: KeyboardEventInit = {}) => root.trigger('keydown', { key, ...fields })
	return { wrapper, root, stage: wrapper.find('.loupe-stage'), decoded, decided, scheduler, press }
}

const plain = (text: string | undefined) => text?.replaceAll(TRANSLATED_MARK, '')
const label = (wrapper: Awaited<ReturnType<typeof mountViewer>>['wrapper'], name: string) => wrapper.find(`button[aria-label="${TRANSLATED_MARK}${name}"]`)
const indices = (wrapper: Awaited<ReturnType<typeof mountViewer>>['wrapper']) => wrapper.emitted('update:index')?.map(([index]) => index)
const zoomText = (wrapper: Awaited<ReturnType<typeof mountViewer>>['wrapper']) => plain(label(wrapper, 'Toggle fit and 100 percent').text())

enableAutoUnmount(afterEach)

describe('SeriesViewer', () => {
	beforeEach(installMarkedCatalogue)
	afterEach(() => {
		uninstallMarkedCatalogue()
		listeners.splice(0).forEach((listener) => window.removeEventListener('keydown', listener))
	})

	// spec: SERIES-002.1
	it('shows the photo with its name and place, the loupe controls without its panels, and preloads its neighbours', async () => {
		const { wrapper, root, decoded } = await mountViewer()

		expect(plain(root.attributes('aria-label'))).toBe('Series viewer')
		expect(root.attributes('data-hotkeys-screen')).toBeDefined()
		expect(wrapper.find('h2').text()).toBe('IMG_2')
		expect(plain(wrapper.find('.series-viewer__place').text())).toBe('Series 2 of 3 · photo 2 of 3')
		expect(plain(label(wrapper, 'Back to the series').text())).toBe('Back to the series')
		expect(wrapper.find('.flag-buttons-toggle, button[aria-label$="Flag buttons"]').exists()).toBe(true)
		expect(wrapper.find('.loupe-filmstrip').exists()).toBe(false)
		expect(label(wrapper, 'Toggle info panel').exists()).toBe(false)
		expect(wrapper.find('.pick-rest-button').exists()).toBe(true)
		expect(decoded).toEqual(['/img/2/4096', '/img/3/4096', '/img/1/4096'])
	})

	// spec: SERIES-002.1
	it('preloads the loupe\'s window of 3 ahead and 2 behind, following the page and a photo that leaves', async () => {
		const burst = picturesOf([1, 2, 3, 4, 5, 6, 7, 8].map((id) => listingEntry(id, `/Trip/IMG_${id}.JPG`))) as Picture<ListingEntry>[]
		const { wrapper, decoded } = await mountViewer(2, {}, burst)
		expect(decoded).toEqual([3, 4, 2, 5, 1, 6].map((id) => `/img/${id}/4096`))

		await wrapper.setProps({ pictures: burst.filter((_picture, index) => index !== 2) })
		await wrapper.setProps({ index: 6 })

		expect(decoded.slice(6)).toEqual(['/img/7/4096', '/img/8/4096'])
	})

	// spec: SERIES-002.2
	it('pages by the buttons, the arrow keys and the tap zones, not beyond the ends', async () => {
		const { wrapper, stage, press } = await mountViewer(0)
		expect(label(wrapper, 'Previous photo').exists()).toBe(false)
		await tap(stage, 100, 0)
		expect(indices(wrapper)).toBeUndefined()

		await label(wrapper, 'Next photo').trigger('click')
		await press('ArrowRight')
		await press('ArrowRight')
		await tap(stage, 100, 1000)
		await tap(stage, 900, 2000)
		await press('ArrowLeft')

		expect(indices(wrapper)).toEqual([1, 2, 1, 2, 1])
	})

	// spec: SERIES-002.2
	it('pages by a sideways swipe', async () => {
		const { wrapper, stage } = await mountViewer(1)
		await pointer(stage, 'pointerdown', { x: 600, time: 0 })
		await pointer(stage, 'pointermove', { x: 100, time: 100 })
		await pointer(stage, 'pointerup', { x: 100, time: 150 })

		expect(indices(wrapper)).toEqual([2])
	})

	// spec: SERIES-002.3
	it('zooms by Z, the button and a double-tap, keeps the zoom across paging and says it is synced', async () => {
		const { wrapper, stage, press } = await mountViewer(0)
		const synced = () => plain(wrapper.find('.series-viewer__sync').text())
		expect(zoomText(wrapper)).toBe('Fit')
		expect(synced()).toBe('')

		await press('z')
		expect(zoomText(wrapper)).toBe('100 %')
		expect(synced()).toBe('Zoom synced on all 3 photos')
		expect(wrapper.find('.series-viewer__sync').attributes('aria-live')).toBe('polite')
		await press('ArrowRight')
		expect(indices(wrapper)).toEqual([1])
		expect(zoomText(wrapper)).toBe('100 %')

		await label(wrapper, 'Toggle fit and 100 percent').trigger('click')
		expect(zoomText(wrapper)).toBe('Fit')
		await tap(stage, 500, 1000)
		await tap(stage, 500, 1100)
		expect(zoomText(wrapper)).toBe('100 %')
		expect(wrapper.find('.series-viewer--chrome-free').exists()).toBe(false)
	})

	// spec: SERIES-002.4
	it('fades the controls when idle and toggles them by a tap in the middle', async () => {
		const { root, stage, scheduler } = await mountViewer()
		expect(root.classes()).not.toContain('series-viewer--idle')

		scheduler.fire()
		await flushPromises()
		expect(root.classes()).toContain('series-viewer--idle')
		await tap(stage, 500, 0)
		expect(root.classes()).not.toContain('series-viewer--idle')
		await root.trigger('pointermove', { pointerType: 'mouse' })
		expect(root.classes()).not.toContain('series-viewer--idle')
	})

	// spec: SERIES-002.5
	it('decides the shown photo by the bar and the keys without moving on, and with Shift moves on', async () => {
		const { wrapper, decided, press } = await mountViewer(0)
		wrapper.findComponent(ActionBar).vm.$emit('decide', { kind: 'rating', rating: 4 })
		await press('p')
		await press('u')
		expect(indices(wrapper)).toBeUndefined()

		await press('P', { shiftKey: true })
		await press('X', { shiftKey: true })
		await press(']')

		expect(decided).toEqual([
			[{ kind: 'rating', rating: 4 }, 'IMG_1'],
			[{ kind: 'flag', flag: 'picked' }, 'IMG_1'],
			[{ kind: 'flag', flag: 'unflagged' }, 'IMG_1'],
			[{ kind: 'flag', flag: 'picked' }, 'IMG_1'],
			[{ kind: 'flag', flag: 'rejected' }, 'IMG_2'],
			[{ kind: 'rating', rating: 1 }, 'IMG_2'],
		])
		expect(indices(wrapper)).toEqual([1])
	})

	// spec: SERIES-002.5
	it('decides by a swipe up or down as the settings say, and not while zoomed', async () => {
		const { stage, decided, press } = await mountViewer(1)
		for (const [from, to, time] of [[100, 400, 0], [400, 100, 1000]] as const) {
			await pointer(stage, 'pointerdown', { x: 500, y: from, time })
			await pointer(stage, 'pointermove', { x: 500, y: to, time: time + 100 })
			await pointer(stage, 'pointerup', { x: 500, y: to, time: time + 100 })
		}
		await press('z')
		await pointer(stage, 'pointerdown', { x: 500, y: 100, time: 2000 })
		await pointer(stage, 'pointermove', { x: 500, y: 400, time: 2100 })
		await pointer(stage, 'pointerup', { x: 500, y: 400, time: 2100 })

		expect(decided).toEqual([[{ kind: 'flag', flag: 'rejected' }, 'IMG_2'], [{ kind: 'flag', flag: 'picked' }, 'IMG_2']])
	})

	// spec: SERIES-002.7
	it('picks the shown photo and rejects the rest by the button and Shift+K', async () => {
		const { wrapper, press } = await mountViewer(2)
		await wrapper.find('.pick-rest-button').trigger('click')
		await press('K', { shiftKey: true })

		expect(wrapper.emitted('pickRest')).toEqual([[SERIES[2]], [SERIES[2]]])
	})

	// spec: SERIES-002.9
	it('goes back to the series by its button and Esc', async () => {
		const { wrapper, press } = await mountViewer()
		// spec: APP-002.9
		expect(label(wrapper, 'Back to the series').attributes('data-tip-key')).toBe('Esc')
		await label(wrapper, 'Back to the series').trigger('click')
		await press('Escape')

		expect(wrapper.emitted('close')).toHaveLength(2)
	})

	// spec: SERIES-002.5
	it('hides the flag buttons by B and says how to show them', async () => {
		const { wrapper, press } = await mountViewer()
		await press('b')

		expect(wrapper.emitted('updateSettings')).toEqual([[{ flagButtonsShown: false }]])
		expect(plain((wrapper.emitted('toast') as [Toast][])[0]![0].message)).toBe('Flag buttons hidden · B shows them')
		expect(wrapper.find('.flag-buttons--large, .action-bar__flags').exists()).toBe(false)
	})

	// spec: TAGS-003.1, TAGS-003.2
	it('opens the tag entry for the shown photo by T and by Tags', async () => {
		const { wrapper, press } = await mountViewer(1)

		await press('t')
		wrapper.findComponent(ActionBar).vm.$emit('tag')

		expect(wrapper.emitted('tag')!.map(([picture]) => (picture as Picture<ListingEntry>).baseName)).toEqual(['IMG_2', 'IMG_2'])
	})
})
