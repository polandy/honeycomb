// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { ListingEntry } from '../../src/logic/listing.ts'
import type { Picture } from '../../src/logic/pairing.ts'
import type { SendProgress } from '../../src/logic/request-chunks.ts'
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../../src/logger.ts'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { MIGRATION_PART, useSidecarFlow } from '../../src/sidecar-flow.ts'
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
	}))
}

/** The flow over sidecars that read BYTES and save as `answer` says; it records the progress at each save, the acknowledgements and the toasts. */
function flowWith(answer: (item: SidecarSaveItem) => SidecarSaveAnswer = () => ({ result: 'saved', fileId: 1, etag: 's', size: 1, mtime: 2 }), saveFails = false) {
	const progress: (SendProgress | null)[] = []
	const acknowledged: number[][] = []
	const toasts: { message: string, action: ToastAction | null }[] = []
	const saves: (number | string)[][] = []
	const flow = useSidecarFlow({
		lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			progress.push(flow.progress.value)
			saves.push(items.map((item) => ('fileId' in item ? item.fileId : item.path)))
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
	return { flow, progress, acknowledged, toasts, saves }
}

const rated = () => ({ ...UNDECIDED, rating: 3 })
const NONE_SKIPPED = () => false

describe('useSidecarFlow: writing through', () => {
	// spec: XMP-003.13, XMP-003.33
	it('names the reason in the toast of a failed write, and Details names each sidecar', async () => {
		const { flow, toasts } = flowWith(() => ({ result: 'noVersions' }))

		await flow.sync.write([writesOf(1)[0]!.picture], rated)
		await flushPromises()

		expect(toasts.map(({ message, action }) => [message, action?.label])).toEqual([['Could not write 1 sidecar. File versions are off, so honeycomb does not overwrite an existing sidecar', 'Details']])
		toasts[0]!.action!.run()
		expect(flow.report.value?.map(({ path, reason }) => [path, reason])).toEqual([['/P/IMG_1.JPG.xmp', 'noVersions']])
	})
})

describe('useSidecarFlow: the migration run', () => {
	// spec: XMP-007.11
	it('writes in parts, shows the progress, acknowledges each part and ends with one toast', async () => {
		const { flow, progress, acknowledged, toasts } = flowWith()
		flow.ask(writesOf(45))

		const running = flow.confirm(rated, NONE_SKIPPED)
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

		await flow.confirm(rated, NONE_SKIPPED)
		await flushPromises()

		expect(acknowledged).toEqual([[1]])
		expect(toasts.map(({ message, action }) => [message, action?.label])).toEqual([['Could not write 1 of 2 photos. You may not change this sidecar or create files in its folder', 'Details']])
		toasts[0]!.action!.run()
		expect(flow.report.value?.map(({ path, reason }) => [path, reason])).toEqual([['/P/IMG_2.JPG.xmp', 'notPermitted']])
	})

	// spec: XMP-007.12
	it('acknowledges nothing when every save fails', async () => {
		vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { flow, acknowledged, toasts } = flowWith(undefined, true)
		flow.ask(writesOf(2))

		await flow.confirm(rated, NONE_SKIPPED)
		await flushPromises()

		expect(acknowledged).toEqual([])
		expect(toasts.map(({ message }) => message)).toEqual(['Could not write 2 of 2 photos. Could not reach the server'])
	})

	// spec: XMP-007.12
	it('stops on an error, says so and acknowledges nothing', async () => {
		const error = vi.spyOn(logger, 'error').mockImplementation(() => {})
		const { flow, acknowledged, toasts } = flowWith()
		flow.ask(writesOf(2))
		const failure = new Error('broken')

		await flow.confirm(() => {
			throw failure
		}, NONE_SKIPPED)
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

		await flow.confirm(rated, NONE_SKIPPED)

		expect([acknowledged, progress]).toEqual([[], []])
		expect(toasts.map(({ message }) => message)).toEqual(['No stored decisions to write here'])
		expect(flow.open.value).toBe(false)
	})

	// spec: XMP-007.13
	it('skips the pictures in shared folders not confirmed: saves none of their sidecars, keeps their rows and says how many', async () => {
		const { flow, acknowledged, toasts, saves } = flowWith()
		const writes = writesOf(3)
		const skipped = new Set([writes[0]!.picture, writes[2]!.picture])
		flow.ask(writes)

		await flow.confirm(rated, (picture) => skipped.has(picture))
		await flushPromises()

		expect(saves).toEqual([[1002]])
		expect(acknowledged).toEqual([[2]])
		expect(toasts.map(({ message }) => message)).toEqual(['Wrote the decisions of 1 photo to sidecars; skipped 2 photos in shared folders not confirmed'])
	})

	// spec: XMP-007.13
	it('writes the pictures of a folder confirmed since the last run', async () => {
		const { flow, acknowledged, toasts } = flowWith()
		const writes = writesOf(2)
		let confirmed = false
		const unconfirmed = (picture: Picture<ListingEntry>) => !confirmed && picture === writes[1]!.picture
		flow.ask(writes)
		await flow.confirm(rated, unconfirmed)
		confirmed = true
		flow.ask(writes)

		await flow.confirm(rated, unconfirmed)
		await flushPromises()

		expect(acknowledged).toEqual([[1], [1, 2]])
		expect(toasts.map(({ message }) => message)).toEqual(['Wrote the decisions of 1 photo to sidecars; skipped 1 photo in a shared folder not confirmed', 'Wrote the decisions of 2 photos to sidecars'])
	})

	// spec: XMP-007.13
	it('writes nothing when every picture is skipped and says so', async () => {
		const { flow, acknowledged, toasts, saves } = flowWith()
		flow.ask(writesOf(2))

		await flow.confirm(rated, () => true)

		expect([acknowledged, saves]).toEqual([[], []])
		expect(toasts.map(({ message }) => message)).toEqual(['No stored decisions to write here; skipped 2 photos in shared folders not confirmed'])
	})
})
