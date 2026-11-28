// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ImmichApi } from '../../src/immich/immich-source.ts'
import type { ConnectionStatus, ImmichAvailability } from '../../src/logic/immich-connections.ts'

import { enableAutoUnmount, flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import AppNavigation from '../../src/components/AppNavigation.vue'
import FolderPicker from '../../src/components/FolderPicker.vue'
import FoldersHome from '../../src/components/FoldersHome.vue'
import ImmichScreen from '../../src/components/ImmichScreen.vue'
import { logger } from '../../src/shared/logger.ts'
import { mountApp, openCull } from './app-cull.ts'

enableAutoUnmount(afterEach)
afterEach(() => {
	vi.restoreAllMocks()
})

const PHONE = { id: 'andy-phone', label: 'Andy · Phone', url: 'https://immich.example', picksAsFavorites: false }
const CONNECTED: ImmichAvailability = { kind: 'connections', connections: [PHONE] }
const OK: ConnectionStatus = { state: 'ok', account: 'andy', version: '2.3.1', total: 3660 }
const REFUSED: ConnectionStatus = { state: 'refused', account: null, version: null, total: null }

/** An Immich server with the connections that answers every status as given. */
function immichOn(availability: ImmichAvailability, status: ConnectionStatus = OK): ImmichApi {
	return { listConnections: async () => availability, status: async () => status }
}

/** honeycomb opened with the stored settings and the Immich server. */
async function start(stored: object, immich: ImmichApi) {
	const app = mountApp({ immich, loadSettings: async () => stored })
	await flushPromises()
	return app
}

/** The folder picker, opened from the navigation as the start no longer opens it (FOLDERS-007.16). */
async function openPicker(wrapper: Awaited<ReturnType<typeof start>>['wrapper']) {
	wrapper.findComponent(AppNavigation).vm.$emit('chooseFolders')
	await flushPromises()
	return wrapper.findComponent(FolderPicker)
}

describe('App: I only use Immich', () => {
	// spec: IMMICH-001.21
	it('offers the choice to the folder picker once the connection to open answers ok', async () => {
		const ok = (await start({}, immichOn(CONNECTED))).wrapper
		const refused = (await start({}, immichOn(CONNECTED, REFUSED))).wrapper
		const none = (await start({}, immichOn({ kind: 'none' }))).wrapper

		expect((await openPicker(ok)).props('immichOnly')).toBe('ok')
		expect((await openPicker(refused)).props('immichOnly')).toBe('refused')
		expect((await openPicker(none)).props('immichOnly')).toBe('none')
	})

	// spec: IMMICH-001.22
	it('closes the picker, opens Immich and stores the choice', async () => {
		const { wrapper, savedSettings } = await start({}, immichOn(CONNECTED))

		const picker = await openPicker(wrapper)
		picker.vm.$emit('immichOnly')
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		expect(wrapper.findComponent(AppNavigation).props('source')).toBe('immich')
		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(true)
		expect(savedSettings.at(-1)).toMatchObject({ immichOnly: true })
	})

	// spec: IMMICH-001.23
	it('opens Immich at the start without the folder picker once the choice is stored', async () => {
		let answer: (status: ConnectionStatus) => void = () => undefined
		const immich: ImmichApi = { listConnections: async () => CONNECTED, status: () => new Promise((resolve) => (answer = resolve)) }
		const { wrapper } = await start({ immichOnly: true }, immich)
		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		expect(wrapper.findComponent(FoldersHome).attributes('style')).toContain('display: none')

		answer(OK)
		await flushPromises()
		answer(OK)
		await flushPromises()

		expect(wrapper.findComponent(FolderPicker).exists()).toBe(false)
		expect(wrapper.findComponent(AppNavigation).props('source')).toBe('immich')
		expect(wrapper.findComponent(ImmichScreen).exists()).toBe(true)
	})

	// spec: IMMICH-001.24
	it.each([
		['refused', immichOn(CONNECTED, REFUSED), 'refused'],
		['broken', immichOn({ kind: 'broken' }), 'broken'],
		['gone', immichOn({ kind: 'connections', connections: [] }), 'none'],
	] as const)('opens Nextcloud when the connection is %s, its picker naming why, and keeps the choice', async (_, immich, offer) => {
		const { wrapper, savedSettings } = await start({ immichOnly: true }, immich)

		expect(wrapper.findComponent(AppNavigation).props('source')).toBe('nextcloud')
		expect(wrapper.findComponent(FoldersHome).attributes('style') ?? '').not.toContain('display: none')
		expect((await openPicker(wrapper)).props('immichOnly')).toBe(offer)
		expect(savedSettings).toEqual([])
	})

	// spec: IMMICH-001.24
	it('opens Nextcloud when the settings cannot be read', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { wrapper } = mountApp({ immich: immichOn(CONNECTED), loadSettings: async () => Promise.reject(new Error('offline')) })
		await flushPromises()

		expect(wrapper.findComponent(AppNavigation).props('source')).toBe('nextcloud')
		expect((await openPicker(wrapper)).props('immichOnly')).toBe('ok')
	})

	// spec: IMMICH-001.25
	it('clears the choice when a folder set opens', async () => {
		const { wrapper, savedSettings } = await start({ immichOnly: true }, immichOn(CONNECTED, REFUSED))

		await openCull(wrapper)

		expect(savedSettings.at(-1)).toMatchObject({ immichOnly: false })
	})

	// spec: IMMICH-001.25
	it('leaves the settings alone when a folder set opens without the choice', async () => {
		const { wrapper, savedSettings } = await start({}, immichOn(CONNECTED))

		await openCull(wrapper)

		expect(savedSettings).toEqual([])
	})
	// spec: APP-001.27
	it('marks the page settled once the settings and the Immich offer the start waits for have answered', async () => {
		let answerSettings: (stored: object) => void = () => undefined
		let answerConnections: (availability: ImmichAvailability) => void = () => undefined
		const immich: ImmichApi = { listConnections: async () => new Promise((resolve) => {
			answerConnections = resolve
		}), status: async () => OK }
		const { wrapper } = mountApp({ immich, loadSettings: async () => new Promise((resolve) => {
			answerSettings = resolve
		}) })
		await flushPromises()
		expect(wrapper.attributes('data-settled')).toBeUndefined()

		answerSettings({ immichOnly: true })
		await flushPromises()
		expect(wrapper.attributes('data-settled')).toBeUndefined()

		answerConnections(CONNECTED)
		await flushPromises()
		expect(wrapper.attributes('data-settled')).toBe('true')
	})

	// spec: APP-001.27
	it('marks the page settled on unreadable settings, the start then on Folders', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const { wrapper } = await start({}, immichOn({ kind: 'none' }))
		const failed = mountApp({ immich: immichOn({ kind: 'none' }), loadSettings: async () => Promise.reject(new Error('down')) }).wrapper
		await flushPromises()

		expect(wrapper.attributes('data-settled')).toBe('true')
		expect(failed.attributes('data-settled')).toBe('true')
		expect(failed.findComponent(FoldersHome).isVisible()).toBe(true)
	})
})
