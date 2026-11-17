// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SendProgress } from '../../src/logic/request-chunks.ts'
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { MIGRATION_PART, useSidecarFlow } from '../../src/sidecar-flow.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from './logic/xmp/xmp-builders.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)

/** `count` decided pictures, each a JPEG `i` with its sidecar `1000 + i`. */
function writesOf(count: number) {
	return Array.from({ length: count }, (_, index) => ({
		picture: pictureOf(listingEntry(index + 1, `/P/IMG_${index + 1}.JPG`), listingEntry(1000 + index + 1, `/P/IMG_${index + 1}.JPG.xmp`)),
		decided: true,
		tags: [],
		shared: false,
	}))
}

/** The flow over sidecars that read BYTES and save as `answer` says; it records the progress at each save, the acknowledgements and the toasts. */
function flowWith(answer: (item: SidecarSaveItem) => SidecarSaveAnswer = () => ({ result: 'saved', fileId: 1, etag: 's', size: 1, mtime: 2 }), saveFails = false) {
	const progress: (SendProgress | null)[] = []
	const acknowledged: number[][] = []
	const toasts: { message: string, action: ToastAction | null }[] = []
	const flow = useSidecarFlow({
		lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			progress.push(flow.progress.value)
			if (saveFails) {
				throw new Error('offline')
			}
			return items.map(answer)
		},
		now: () => CANONICAL_TIME,
	}, (message, action) => void toasts.push({ message, action: action ?? null }), () => undefined, async (fileIds) => {
		acknowledged.push([...fileIds])
		return true
	})
	return { flow, progress, acknowledged, toasts }
}

const rated = () => ({ ...UNDECIDED, rating: 3 })

describe('useSidecarFlow: the migration run', () => {
	// spec: XMP-007.11
	it('writes in parts, shows the progress, acknowledges each part and ends with one toast', async () => {
		const { flow, progress, acknowledged, toasts } = flowWith()
		flow.ask(writesOf(45))

		const running = flow.confirm(rated)
		expect(flow.open.value).toBe(true)
		await running
		await flushPromises()

		expect(MIGRATION_PART).toBe(20)
		expect(progress).toEqual([{ done: 0, total: 45 }, { done: 20, total: 45 }, { done: 40, total: 45 }])
		expect(acknowledged.map((ids) => ids.length)).toEqual([20, 20, 5])
		expect(acknowledged[2]).toEqual([41, 42, 43, 44, 45])
		expect(toasts).toEqual([{ message: 'Wrote the decisions of 45 photos to sidecars', action: null }])
		expect(flow.progress.value).toBeNull()
		expect(flow.open.value).toBe(false)
	})

	// spec: XMP-007.12
	it('ends with how many photos failed, and Details names each sidecar', async () => {
		const { flow, acknowledged, toasts } = flowWith((item) => ('fileId' in item && item.fileId === 1002 ? { result: 'notPermitted' } : { result: 'saved', fileId: 1, etag: 's', size: 1, mtime: 2 }))
		flow.ask(writesOf(2))

		await flow.confirm(rated)
		await flushPromises()

		expect(acknowledged).toEqual([[1]])
		expect(toasts.map(({ message, action }) => [message, action?.label])).toEqual([['Could not write 1 of 2 photos', 'Details']])
		toasts[0]!.action!.run()
		expect(flow.report.value?.map(({ path, reason }) => [path, reason])).toEqual([['/P/IMG_2.JPG.xmp', 'notPermitted']])
	})

	// spec: XMP-007.12
	it('acknowledges nothing when every save fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { flow, acknowledged, toasts } = flowWith(undefined, true)
		flow.ask(writesOf(2))

		await flow.confirm(rated)
		await flushPromises()

		expect(acknowledged).toEqual([])
		expect(toasts.map(({ message }) => message)).toEqual(['Could not write 2 of 2 photos'])
	})

	// spec: XMP-007.12
	it('stops on an error, says so and acknowledges nothing', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { flow, acknowledged, toasts } = flowWith()
		flow.ask(writesOf(2))
		const failure = new Error('broken')

		await flow.confirm(() => {
			throw failure
		})
		await flushPromises()

		expect(acknowledged).toEqual([])
		expect(toasts.map(({ message }) => message)).toEqual(['Could not write the sidecars; run it again later.'])
		expect(error).toHaveBeenCalledWith('Could not write the stored decisions to sidecars', { error: failure })
		expect(flow.open.value).toBe(false)
	})

	// spec: XMP-007.12
	it('says there is nothing to write without pictures', async () => {
		const { flow, acknowledged, toasts, progress } = flowWith()
		flow.ask([])

		await flow.confirm(rated)

		expect([acknowledged, progress]).toEqual([[], []])
		expect(toasts.map(({ message }) => message)).toEqual(['No stored decisions to write here'])
		expect(flow.open.value).toBe(false)
	})
})
