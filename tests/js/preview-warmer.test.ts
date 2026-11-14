// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { WarmOptions } from '../../src/preview-warmer.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { usePreviewWarmer, WARMED_PREVIEWS_KEY } from '../../src/preview-warmer.ts'
import { fakeStorage } from './app-cull.ts'
import { listingEntry } from './logic/listing-entries.ts'

afterEach(() => vi.restoreAllMocks())

const members = (...ids: number[]) => ids.map((id) => listingEntry(id, `/A/${id}.JPG`, { mtime: 100 + id }))

/** A warm-up that renders every chunk it is sent at once, and records the calls. */
function renderingAll() {
	const calls: { fileIds: number[], options: WarmOptions }[] = []
	const warm = async (fileIds: readonly number[], options: WarmOptions) => {
		calls.push({ fileIds: [...fileIds], options })
		options.onWarmed?.(fileIds)
	}
	return { warm, calls }
}

describe('usePreviewWarmer', () => {
	// spec: IMAGES-001.15
	it('sends only the files not yet warmed at their mtime and keeps them for the next visit', async () => {
		const stored: Record<string, string> = { [WARMED_PREVIEWS_KEY]: '["1:101","2:999"]' }
		const { warm, calls } = renderingAll()

		usePreviewWarmer(warm, fakeStorage(stored)).warm(members(1, 2, 3))
		await flushPromises()

		expect(calls.map((call) => call.fileIds)).toEqual([[2, 3]])
		expect(new Set(JSON.parse(stored[WARMED_PREVIEWS_KEY]!))).toEqual(new Set(['1:101', '2:999', '2:102', '3:103']))
	})

	// spec: IMAGES-001.15
	it('sends nothing when every file is warmed, and keeps those it skipped as the newest', async () => {
		const stored: Record<string, string> = {}
		const { warm, calls } = renderingAll()
		const warmer = usePreviewWarmer(warm, fakeStorage(stored))
		warmer.warm(members(1, 2))
		await flushPromises()

		warmer.warm(members(1))
		await flushPromises()

		expect(calls).toHaveLength(1)
		expect(JSON.parse(stored[WARMED_PREVIEWS_KEY]!)).toEqual(['2:102', '1:101'])
	})

	// spec: IMAGES-001.14
	it('aborts the running warm-up when the next one starts', async () => {
		const signals: AbortSignal[] = []
		const warmer = usePreviewWarmer(async (_fileIds, options) => {
			signals.push(options.signal!)
		}, fakeStorage())

		warmer.warm(members(1))
		warmer.warm(members(2))

		expect(signals.map((signal) => signal.aborted)).toEqual([true, false])
	})

	// spec: IMAGES-001.11, IMAGES-001.15
	it('logs a failed warm-up and keeps only the chunks the server rendered', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => undefined)
		const stored: Record<string, string> = {}
		const warmer = usePreviewWarmer(async (_fileIds, options) => {
			options.onWarmed?.([1])
			throw new Error('down')
		}, fakeStorage(stored))

		warmer.warm(members(1, 2))
		await flushPromises()

		expect(error).toHaveBeenCalledOnce()
		expect(JSON.parse(stored[WARMED_PREVIEWS_KEY]!)).toEqual(['1:101'])
	})

	it('remembers warmed files for this visit when site data is blocked', async () => {
		const { warm, calls } = renderingAll()
		const warmer = usePreviewWarmer(warm, fakeStorage({}, true))

		warmer.warm(members(1))
		await flushPromises()
		warmer.warm(members(1, 2))
		await flushPromises()

		expect(calls.map((call) => call.fileIds)).toEqual([[1], [2]])
	})
})
