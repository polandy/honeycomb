// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { useSettings } from '../../src/settings.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

/** The settings composable over a fake server holding `stored`. */
function settingsOn(load: () => Promise<unknown>, save: (settings: object) => Promise<void> = async () => undefined) {
	const saved: object[] = []
	const toasts: string[] = []
	const state = useSettings({
		loadSettings: load,
		saveSettings: (settings) => {
			saved.push(settings)
			return save(settings)
		},
	}, (message) => toasts.push(message))
	return { ...state, saved, toasts }
}

describe('useSettings', () => {
	// spec: SETTINGS-001.6
	it('starts with the defaults and takes the stored settings once they are read', async () => {
		const { settings } = settingsOn(async () => ({ viKeys: true, showSingles: 'no' }))

		expect(settings.value).toEqual(DEFAULT_SETTINGS)
		await flushPromises()
		expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, viKeys: true })
	})

	// spec: SETTINGS-001.12
	it('keeps the defaults when the settings cannot be read', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { settings } = settingsOn(async () => {
			throw new Error('offline')
		})

		await flushPromises()

		expect(settings.value).toEqual(DEFAULT_SETTINGS)
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: SETTINGS-001.11
	it('applies a change at once and saves the whole settings', async () => {
		const { settings, update, saved, toasts } = settingsOn(async () => ({}))
		await flushPromises()

		update({ autoAdvance: false })

		expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, autoAdvance: false })
		expect(saved).toEqual([{ ...DEFAULT_SETTINGS, autoAdvance: false }])
		await flushPromises()
		expect(toasts).toEqual([])
	})

	// spec: SETTINGS-001.12
	it('keeps a change whose save failed for this visit and says so', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { settings, update, toasts } = settingsOn(async () => ({}), async () => {
			throw new Error('offline')
		})
		await flushPromises()

		update({ viKeys: true })
		await flushPromises()

		expect(settings.value.viKeys).toBe(true)
		expect(toasts).toEqual(['Could not save the settings; they apply until you reload.'])
		expect(error).toHaveBeenCalledOnce()
	})

	// spec: SETTINGS-001.11
	it('saves a change made before the stored settings arrive over them, keeping their other values', async () => {
		let answer: (value: unknown) => void = () => undefined
		const { settings, update, saved } = settingsOn(() => new Promise((resolve) => {
			answer = resolve
		}))

		update({ viKeys: true })
		expect(settings.value.viKeys).toBe(true)
		expect(saved).toEqual([])
		answer({ viKeys: false, autoAdvance: false })
		await flushPromises()

		expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, autoAdvance: false, viKeys: true })
		expect(saved).toEqual([{ ...DEFAULT_SETTINGS, autoAdvance: false, viKeys: true }])
	})

	// spec: SETTINGS-001.12
	it('never saves over settings it could not read, and says a change lasts this visit', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		let fail: (error: Error) => void = () => undefined
		const { settings, update, saved, toasts } = settingsOn(() => new Promise((_resolve, reject) => {
			fail = reject
		}))

		update({ viKeys: true })
		fail(new Error('offline'))
		await flushPromises()
		update({ autoAdvance: false })

		expect(settings.value).toEqual({ ...DEFAULT_SETTINGS, viKeys: true, autoAdvance: false })
		expect(saved).toEqual([])
		expect(toasts).toEqual(['Could not save the settings; they apply until you reload.', 'Could not save the settings; they apply until you reload.'])
	})
})
