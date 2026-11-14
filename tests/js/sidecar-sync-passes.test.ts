// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { readXmp } from '../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, itemsOf, packetOf, seq, textOf } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
const SINGLE = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(11, '/P/IMG_0001.NEF.xmp'))
const OTHER = pictureOf(listingEntry(3, '/P/B.NEF'), listingEntry(13, '/P/B.NEF.xmp'))
const BYTES = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Places/Lisbon']), 'xmp:Rating': '3' }), CANONICAL_TIME)

/** A sync whose lookups read BYTES, whose first save waits for `first`, and whose saves answer as `answer` says; it records each save request. */
function sync(answer: (item: SidecarSaveItem) => SidecarSaveAnswer = (item) => saved('fileId' in item ? item.fileId : 30)) {
	let release!: () => void
	const first = new Promise<void>((resolve) => {
		release = resolve
	})
	const saves: SidecarSaveItem[][] = []
	const sidecars = useSidecarSync({
		lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			saves.push([...items])
			if (saves.length === 1) {
				await first
			}
			return items.map(answer)
		},
	}, () => CANONICAL_TIME, () => undefined)
	return { sidecars, saves, release }
}

/** A `saved` answer for the file id. */
function saved(fileId: number): SidecarSaveAnswer {
	return { result: 'saved', fileId, etag: `saved-${fileId}`, size: 1, mtime: 1 }
}

const rated = (rating: number): Decision => ({ ...UNDECIDED, rating })

describe('useSidecarSync: passes', () => {
	// spec: XMP-003.16
	it('writes the steps waiting behind a pass together, each sidecar once', async () => {
		const { sidecars, saves, release } = sync()
		let decision = rated(1)

		const running = sidecars.write([PAIR], () => decision)
		await flushPromises()
		const waiting = [
			sidecars.write([PAIR], () => decision),
			sidecars.writeTags([PAIR], { added: ['Events/Wedding'], removed: [] }),
			sidecars.write([PAIR], () => decision),
			sidecars.writeTags([PAIR], { added: ['Kids'], removed: ['Places/Lisbon'] }),
		]
		decision = rated(5)
		release()

		expect(await Promise.all([running, ...waiting])).toEqual(Array.from({ length: 5 }, () => ({ written: 1, failed: [] })))
		expect(saves.map((items) => items.map((item) => ('fileId' in item ? item.fileId : item.path)))).toEqual([[11, '/P/IMG_0001.JPG.xmp'], [11, 30]])
		const written = saves[1]!.map((item) => readXmp(item.bytes))
		expect(written.map((packet) => [textOf(packet, 'xmp:Rating'), itemsOf(packet, 'digiKam:TagsList')])).toEqual([['5', ['Events/Wedding', 'Kids']], ['5', ['Events/Wedding', 'Kids']]])
	})

	// spec: XMP-003.16
	it('answers each step of a pass with the failures of its own pictures', async () => {
		const { sidecars, release } = sync((item) => ('fileId' in item && item.fileId === 13 ? { result: 'locked' } : saved('fileId' in item ? item.fileId : 30)))

		const running = sidecars.write([PAIR], () => rated(1))
		await flushPromises()
		const mine = sidecars.write([PAIR], () => rated(2))
		const theirs = sidecars.write([OTHER, PAIR], () => rated(2))
		release()

		await running
		expect(await mine).toEqual({ written: 1, failed: [] })
		expect(await theirs).toEqual({ written: 1, failed: [{ path: '/P/B.NEF.xmp', picture: OTHER, reason: 'locked' }] })
	})

	// spec: XMP-003.16, XMP-003.13
	it('retries a failed sidecar of a decision and a tag change with both', async () => {
		const answers = [(): SidecarSaveAnswer => ({ result: 'notPermitted' })]
		const { sidecars, saves, release } = sync((item) => (answers.shift() ?? (() => saved('fileId' in item ? item.fileId : 30)))())
		release()

		const wedding = { added: ['Events/Wedding'], removed: [] }
		const results = await Promise.all([sidecars.write([SINGLE], () => rated(4)), sidecars.writeTags([SINGLE], wedding)])
		const failed = results[1].failed
		await sidecars.retry(failed, () => rated(4))

		expect(failed).toEqual([{ path: '/P/IMG_0001.NEF.xmp', picture: SINGLE, reason: 'notPermitted', tags: wedding, decision: true }])
		const retried = readXmp(saves.at(-1)![0]!.bytes)
		expect([textOf(retried, 'xmp:Rating'), itemsOf(retried, 'digiKam:TagsList')]).toEqual(['4', ['Events/Wedding', 'Places/Lisbon']])
	})

	// spec: XMP-003.17
	it('saves nothing when no sidecar would change', async () => {
		const { sidecars, saves, release } = sync()
		release()

		await Promise.all([sidecars.write([SINGLE], () => rated(4)), sidecars.writeTags([SINGLE], { added: ['Kids'], removed: [] })])
		expect(saves).toHaveLength(1)

		expect(await sidecars.write([SINGLE], () => rated(4))).toEqual({ written: 1, failed: [] })
		expect(await sidecars.writeTags([SINGLE], { added: ['Kids'], removed: ['Events/Wedding'] })).toEqual({ written: 1, failed: [] })
		expect(saves).toHaveLength(1)
	})

	// spec: XMP-003.16
	it('fails every step of a pass that threw and still runs the next pass', async () => {
		const { sidecars, saves, release } = sync()
		release()

		const broken = sidecars.write([PAIR], () => {
			throw new Error('broken')
		})
		const alongside = sidecars.writeTags([OTHER], { added: ['Kids'], removed: [] })

		await expect(broken).rejects.toThrow('broken')
		await expect(alongside).rejects.toThrow('broken')
		expect(await sidecars.write([PAIR], () => rated(2))).toEqual({ written: 1, failed: [] })
		expect(saves).toHaveLength(1)
	})
})
