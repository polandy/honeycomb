// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Settings } from '../../../src/logic/settings.ts'

import { flushPromises, mount } from '@vue/test-utils'
import { afterEach } from 'vitest'
import PhotoLoupe from '../../../src/components/PhotoLoupe.vue'
import { hotkeyListener } from '../../../src/hotkeys.ts'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../../src/logic/settings.ts'
import { GESTURE_GUIDE_SEEN_KEY } from '../../../src/loupe-panels.ts'
import { fakeStorage } from '../app-cull.ts'
import { fakeScheduler } from '../fake-scheduler.ts'
import { listingEntry, picturesOf } from '../logic/listing-entries.ts'

const listeners: ((event: KeyboardEvent) => void)[] = []
afterEach(() => listeners.splice(0).forEach((listener) => window.removeEventListener('keydown', listener)))

export const PICTURES = picturesOf(Array.from({ length: 10 }, (_, at) => listingEntry(at + 1, `/P/IMG_${at + 1}.JPG`, { width: 3000, height: 2000 })))

/** The loupe at `index` on a 1000 × 600 stage with its keys on the window as the app installs them, attached so focus works; the gesture guide was seen unless `firstOpening`; `props` override the defaults, and a settings change applies as the app applies it. */
export async function mountLoupe(index = 4, stored: Record<string, string> = {}, firstOpening = false, props: Record<string, unknown> = {}) {
	if (!firstOpening) {
		stored[GESTURE_GUIDE_SEEN_KEY] = 'true'
	}
	const decoded: string[] = []
	const fullscreen: HTMLElement[] = []
	const scheduler = fakeScheduler()
	const wrapper = mount(PhotoLoupe, {
		attachTo: document.body,
		props: {
			pictures: PICTURES,
			index,
			folderSet: { paths: ['/P'], subfolders: true },
			decisionOf: () => UNDECIDED,
			storage: fakeStorage(stored),
			imageUrl: (fileId: number, size: number) => `/img/${fileId}/${size}`,
			decode: async (src: string) => {
				decoded.push(src)
			},
			schedule: scheduler.schedule,
			toggleFullscreen: (element: HTMLElement) => fullscreen.push(element),
			devicePixelRatio: 1,
			observeSize: (_element: Element, onSize: (width: number, height: number) => void) => {
				onSize(1000, 600)
				return () => undefined
			},
			settings: DEFAULT_SETTINGS,
			'onUpdate:index': (next: number) => wrapper.setProps({ index: next }),
			onUpdateSettings: (patch: Partial<Settings>) => wrapper.setProps({ settings: { ...wrapper.props('settings'), ...patch } }),
			...props,
		},
	})
	const listener = hotkeyListener(() => wrapper.vm.hotkeys, () => wrapper.props('settings').viKeys)
	listeners.push(listener)
	window.addEventListener('keydown', listener)
	await flushPromises()
	return { wrapper, root: wrapper.find('[role="dialog"]'), decoded, fullscreen, scheduler, stored }
}

export const button = (wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper'], label: string) => wrapper.find(`button[aria-label="${label}"]`)
export const indices = (wrapper: Awaited<ReturnType<typeof mountLoupe>>['wrapper']) => wrapper.emitted('update:index')?.map(([index]) => index)
