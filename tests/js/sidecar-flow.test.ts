// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'
import type { ToastAction } from '../../src/toast.ts'

import { flushPromises } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarFlow } from '../../src/sidecar-flow.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from './logic/xmp/xmp-builders.ts'

afterEach(() => {
	vi.restoreAllMocks()
})

const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '1' }), CANONICAL_TIME)

/** The flow over sidecars that read BYTES and save as `answer` says; it records the toasts. */
function flowWith(answer: (item: SidecarSaveItem) => SidecarSaveAnswer = () => ({ result: 'saved', fileId: 1, etag: 's', size: 1, mtime: 2 })) {
	const toasts: { message: string, action: ToastAction | null }[] = []
	const flow = useSidecarFlow({
		lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			return items.map(answer)
		},
		now: () => CANONICAL_TIME,
	}, (message, action) => void toasts.push({ message, action: action ?? null }))
	return { flow, toasts }
}

/** A JPEG with its sidecar. */
const PICTURE = pictureOf(listingEntry(1, '/P/IMG_1.JPG'), listingEntry(1001, '/P/IMG_1.JPG.xmp'))

const rated = () => ({ ...UNDECIDED, rating: 3 })

describe('useSidecarFlow: writing through', () => {
	// spec: XMP-003.13, XMP-003.33, XMP-002.12
	it.each([
		['locked', 'The sidecar is locked (another process is writing to it)'],
		['notPermitted', 'You may not change this sidecar or create files in its folder'],
		['changed', 'The sidecar changed again while honeycomb wrote it'],
		['noSpace', 'No storage space left for the sidecar; free some space or ask the folder\'s owner'],
	] as const)('names the reason in the toast of a failed write (%s), and Details names each sidecar', async (result, reason) => {
		const { flow, toasts } = flowWith(() => ({ result }))

		await flow.sync.write([PICTURE], rated)
		await flushPromises()

		expect(toasts.map(({ message, action }) => [message, action?.label])).toEqual([[`Could not write 1 sidecar. ${reason}`, 'Details']])
		toasts[0]!.action!.run()
		expect(flow.report.value?.map(({ path, reason }) => [path, reason])).toEqual([['/P/IMG_1.JPG.xmp', result]])
	})
})
