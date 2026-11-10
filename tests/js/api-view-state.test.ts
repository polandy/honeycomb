// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import axios from '@nextcloud/axios'
import { describe, expect, it, vi } from 'vitest'
import { ApiResponseError, loadViewState, saveViewState } from '../../src/api.ts'

vi.mock('@nextcloud/axios', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (url: string) => `/index.php${url}` }))

describe('loadViewState', () => {
	// spec: LOUPE-003.1
	it('answers the stored view state as it came', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { viewState: { infoPanelOpen: null, gestureGuideSeen: true } } })

		await expect(loadViewState()).resolves.toEqual({ infoPanelOpen: null, gestureGuideSeen: true })
		expect(axios.get).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/view-state')
	})

	it('refuses an answer without a view state object', async () => {
		vi.mocked(axios.get).mockResolvedValue({ data: { viewState: 'open' } })
		await expect(loadViewState()).rejects.toThrow(ApiResponseError)

		vi.mocked(axios.get).mockResolvedValue({ data: 'viewState' })
		await expect(loadViewState()).rejects.toThrow(ApiResponseError)
	})
})

describe('saveViewState', () => {
	// spec: LOUPE-003.2
	it('writes only the keys given', async () => {
		vi.mocked(axios.put).mockResolvedValue({ data: {} })

		await saveViewState({ gestureGuideSeen: true })

		expect(axios.put).toHaveBeenCalledWith('/index.php/apps/honeycomb/api/v1/view-state', { viewState: { gestureGuideSeen: true } })
	})
})
