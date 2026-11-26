// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichPositionSave } from '../../../src/logic/immich-position.ts'
import type { Page } from '../../../src/logic/immich-paging.ts'
import type { ToastAction } from '../../../src/shared/toast.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ImmichScreen from '../../../src/components/ImmichScreen.vue'
import PhotoGrid from '../../../src/components/PhotoGrid.vue'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { useImmichResume } from '../../../src/immich/immich-resume.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { fakeStorage, fakeViewState } from '../app-cull.ts'
import { COUNTS, cullOn, page } from '../immich-cull-fixtures.ts'
import { NOW } from '../logic/immich-fixtures.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const between = (ids: readonly string[], previousCursor: string | null): Page => ({ ...page(ids), previousCursor })
const STORED = { immich: 'andy-phone', assetId: 'a6', takenAt: NOW - 60, decided: 1, total: 1000, updatedAt: NOW - 3600 }

/** The Immich screen over a fake server, with the resume flow; the stored position is for a6. */
async function mountScreen() {
	const on = cullOn()
	const saved: ImmichPositionSave[] = []
	const toasts: ToastAction[] = []
	const resume = useImmichResume({
		api: { loadPositions: async () => [STORED], savePosition: async (position) => {
			saved.push(position)
		} },
		cull: on.cull,
		toast: (_message, action) => {
			toasts.push(action)
			return () => {}
		},
		connections: () => [{ id: 'andy-phone', label: 'Andy’s phone', url: 'https://immich.example.org' }],
		now: () => NOW,
	})
	on.cull.open('andy-phone')
	resume.offer('andy-phone')
	const wrapper = mount(ImmichScreen, {
		props: { cull: on.cull, resume, settings: DEFAULT_SETTINGS, storage: fakeStorage({}), viewState: fakeViewState({ gesture_guide_seen: true, series_hint_seen: true }, []) },
		global: { stubs: { teleport: true } },
	})
	on.counts[0]!.answer(COUNTS)
	await flushPromises()
	return { ...on, wrapper, saved, toasts }
}

/** The *Show newer photos* button, if shown. */
const newer = (wrapper: Awaited<ReturnType<typeof mountScreen>>['wrapper']) => wrapper.findAll('button').find((each) => each.text() === 'Show newer photos')

describe('ImmichScreen from a position', () => {
	// spec: IMMICH-003.14
	it('opens the loupe at the stored asset on Resume and saves where the loupe goes', async () => {
		const { wrapper, assets, counts, toasts, saved } = await mountScreen()
		toasts[0]!.run()
		counts.at(-1)!.answer(COUNTS)
		assets.at(-1)!.answer(between(['a5', 'a6', 'a7'], 'p4'))
		await flushPromises()

		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('index')).toBe(1)
		expect(loupe.props('counter')).toEqual({ position: null, total: 1000 })
		loupe.vm.$emit('update:index', 2)
		await flushPromises()

		expect(saved.map(({ assetId }) => assetId)).toEqual(['a6', 'a7'])
	})

	// spec: IMMICH-003.14, IMMICH-002.34
	it('loads the newer photos as the loupe nears the start and stays on its asset', async () => {
		const { wrapper, assets, counts, toasts } = await mountScreen()
		toasts[0]!.run()
		counts.at(-1)!.answer(COUNTS)
		assets.at(-1)!.answer(between(['a6', 'a7'], 'p5'))
		await flushPromises()

		expect(assets.at(-1)!.request.cursor).toBe('p5')
		assets.at(-1)!.answer(between(['a4', 'a5'], null))
		await flushPromises()

		const loupe = wrapper.findComponent(PhotoLoupe)
		expect(loupe.props('index')).toBe(2)
		expect(loupe.props('counter')).toEqual({ position: 3, total: 1000 })
	})

	// spec: IMMICH-003.14, IMMICH-002.34
	it('shows the newer photos above the grid on Show newer photos, and the button only while there are some', async () => {
		const { wrapper, assets, cull } = await mountScreen()
		assets[0]!.answer(page(['a1']))
		await flushPromises()
		expect(newer(wrapper)).toBeUndefined()

		cull.resumeFrom({ assetId: 'a6', takenAt: NOW - 60 })
		assets.at(-1)!.answer(between(['a6', 'a7'], 'p5'))
		await flushPromises()
		await newer(wrapper)!.trigger('click')
		expect(assets.at(-1)!.request.cursor).toBe('p5')
		expect(newer(wrapper)!.attributes('disabled')).toBeDefined()
		assets.at(-1)!.answer(between(['a4', 'a5'], null))
		await flushPromises()

		expect(wrapper.findComponent(PhotoGrid).props('pictures')).toHaveLength(4)
		expect(newer(wrapper)).toBeUndefined()
	})
})
