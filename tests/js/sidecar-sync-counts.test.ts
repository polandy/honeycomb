// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { SidecarSaveAnswer, SidecarSaveItem } from '../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { DECISION_FIELDS, UNDECIDED } from '../../src/logic/decision.ts'
import { serializeXmp } from '../../src/logic/xmp/serialize.ts'
import { useSidecarSync } from '../../src/sidecar-sync.ts'
import { listingEntry, pictureOf } from './logic/listing-entries.ts'
import { CANONICAL_TIME, packetOf } from './logic/xmp/xmp-builders.ts'

const PAIR = pictureOf(listingEntry(1, '/P/IMG_0001.NEF'), listingEntry(2, '/P/IMG_0001.JPG'), listingEntry(11, '/P/IMG_0001.NEF.xmp'), listingEntry(12, '/P/IMG_0001.JPG.xmp'))
const BYTES = serializeXmp(packetOf({ 'xmp:Rating': '3' }), CANONICAL_TIME)
const rated = (rating: number) => () => ({ ...UNDECIDED, rating })

/** A sync whose lookups read BYTES and whose saves answer each item in turn as `answers` say, `saved` once they run out; it records each save request. */
function sync(answers: SidecarSaveAnswer['result'][] = []) {
	const saves: SidecarSaveItem[][] = []
	const sidecars = useSidecarSync({
		lookupXmpCache: async () => [],
		saveXmpCache: async () => undefined,
		lookupSidecars: async (fileIds) => fileIds.map(() => ({ result: 'read', bytes: BYTES, etag: 'e', size: BYTES.length, mtime: 1 })),
		lookupEmbeddedXmp: async (fileIds) => fileIds.map(() => ({ result: 'none' })),
		saveSidecars: async (items) => {
			saves.push([...items])
			return items.map((item): SidecarSaveAnswer => {
				const result = answers.shift() ?? 'saved'
				return result === 'saved' ? { result, fileId: 'fileId' in item ? item.fileId : 30, etag: 'next', size: 1, mtime: 2 } : { result }
			})
		},
	}, () => CANONICAL_TIME, () => undefined)
	return { sidecars, saves }
}

const countsOf = (items: readonly SidecarSaveItem[]) => items.map((item) => ('counts' in item ? item.counts : null))

describe('useSidecarSync: counts', () => {
	// spec: STATS-001.36, STATS-001.37
	it('sends a picture\'s counts once, on its first sidecar save, summed over the steps of the pass', async () => {
		const { sidecars, saves } = sync()

		await Promise.all([
			sidecars.write([PAIR], rated(4), DECISION_FIELDS, undefined, () => ({ ratings_set: 1 })),
			sidecars.writeTags([PAIR], { added: ['Kids'], removed: [] }, undefined, () => ({ tags_set: 1 })),
		])

		expect(saves.map(countsOf)).toEqual([[{ ratings_set: 1, tags_set: 1 }, null]])
	})

	// spec: STATS-001.36
	it('sends the counts again with the second round when the save that carried them found its sidecar changed', async () => {
		const { sidecars, saves } = sync(['changed', 'saved'])

		await sidecars.write([PAIR], rated(4), DECISION_FIELDS, undefined, () => ({ ratings_set: 1 }))

		expect(saves.map(countsOf)).toEqual([[{ ratings_set: 1 }, null], [{ ratings_set: 1 }]])
	})

	// spec: STATS-001.36
	it('does not send the counts again once a save carried them', async () => {
		const { sidecars, saves } = sync(['saved', 'changed'])

		await sidecars.write([PAIR], rated(4), DECISION_FIELDS, undefined, () => ({ ratings_set: 1 }))

		expect(saves.map(countsOf)).toEqual([[{ ratings_set: 1 }, null], [null]])
	})
})
