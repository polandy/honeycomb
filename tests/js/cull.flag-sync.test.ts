// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
// @vitest-environment happy-dom
import type { Decision } from '../../src/logic/decision.ts'
import type { XmpCacheRow } from '../../src/logic/xmp-cache.ts'

import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { XMP_READER } from '../../src/logic/xmp-cache.ts'
import { listingEntry } from './logic/listing-entries.ts'
import { ENTRIES, SET, stored } from './app-cull.ts'
import { access, cullWith } from './cull-sidecars-fake.ts'

const PICKED: Decision = { ...UNDECIDED, flag: 'picked' }
const REJECTED: Decision = { ...UNDECIDED, flag: 'rejected' }

/** The listing with IMG_2's sidecar under the ETag. */
const withSidecar = (etag: string) => [...ENTRIES, listingEntry(5, '/Trip/B/IMG_2.JPG.xmp', { etag })]

/** The cache row of IMG_2's sidecar stating the flag. */
function sidecarRow(etag: string, flag: Decision['flag'], state: XmpCacheRow['state'] = 'read'): XmpCacheRow {
	return { fileId: 5, kind: 'sidecar', etag, reader: XMP_READER, state, reason: null, rating: null, flag, colourLabel: null, keepRaw: null, tags: null }
}

describe('useCull: writing flags through to the sidecars', () => {
	// spec: XMP-003.43
	it('writes a flag and a Keep RAW step through with their flag fields', async () => {
		const { cull, writes, flags, picture } = cullWith({ writeFlags: true })
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'picked' }, [picture('IMG_10')])
		cull.decide({ kind: 'keepRaw' }, [picture('IMG_10')])
		await flushPromises()

		expect(flags.saves.map((items) => items.map(({ fileId }) => fileId))).toEqual([[2, 3], [2, 3]])
		expect(writes.map((write) => write.map(({ name, decision, fields }) => [name, decision.flag, decision.keepRaw, fields]))).toEqual([
			[['IMG_10', 'picked', false, ['flag']]],
			[['IMG_10', 'picked', true, ['keepRaw']]],
		])
	})

	// spec: XMP-003.44
	it('keeps a flag whose sidecar write failed and takes a failed rating back', async () => {
		const { cull, writes, flags, picture, notSaved } = cullWith({ writeFlags: true, failing: { IMG_10: 'notPermitted' } })
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.decide({ kind: 'flag', flag: 'rejected' }, [picture('IMG_10')])
		cull.decide({ kind: 'rating', rating: 2 }, [picture('IMG_10')])
		await flushPromises()

		expect(writes).toHaveLength(2)
		expect(cull.decisionOf(picture('IMG_10'))).toMatchObject({ flag: 'rejected', rating: 0 })
		expect(flags.saves).toMatchObject([[2, 3].map((fileId) => ({ fileId, flag: 'rejected' }))])
		expect(notSaved).toEqual([])
	})

	// spec: XMP-003.45
	it('records the ETag of each saved sidecar for its member, also with the setting off', async () => {
		const { cull, flags, picture } = cullWith({ stored: [stored(2, 'picked'), stored(3, 'picked')] })
		cull.open(SET, ENTRIES)
		await flushPromises()

		cull.sidecarsSaved([{ picture: picture('IMG_10'), path: '/Trip/A/IMG_10.CR3.xmp', created: true, fileId: 50, etag: 'n1' }])
		await flushPromises()

		expect(flags.etagSaves).toEqual([[{ fileId: 3, sidecarEtag: 'n1' }]])
	})
})

describe('useCull: syncing the flags with the sidecars on a visit', () => {
	// spec: DECISIONS-001.41
	it('takes a picture over with the ETag of the sidecar it read', async () => {
		const { flags, open } = cullWith({ takenOver: Promise.resolve(new Map([['IMG_2', PICKED]])), rows: [sidecarRow('s1', 'picked')] })

		open(SET, withSidecar('s1'))
		await flushPromises()

		expect(flags.takenOver.flat().find(({ fileId }) => fileId === 1)).toEqual({ fileId: 1, flag: 'picked', keepRaw: false, sidecarEtag: 's1' })
	})

	// spec: XMP-003.46
	it('records the ETag of a sidecar that states the row and writes nothing', async () => {
		const { writes, flags, open } = cullWith({ writeFlags: true, stored: [stored(1, 'picked')], takenOver: Promise.resolve(new Map([['IMG_2', PICKED]])), rows: [sidecarRow('s1', 'picked')] })

		open(SET, withSidecar('s1'))
		await flushPromises()

		expect(flags.etagSaves).toEqual([[{ fileId: 1, sidecarEtag: 's1' }]])
		expect(writes).toEqual([])
	})

	// spec: XMP-003.47
	it('takes over a flag changed in digiKam without an undo step or counts and records its ETag', async () => {
		const { cull, writes, flags, open, picture } = cullWith({ writeFlags: true, stored: [stored(1, 'rejected')], etags: { 1: 'e1' }, takenOver: Promise.resolve(new Map([['IMG_2', PICKED]])), rows: [sidecarRow('e2', 'picked')] })

		open(SET, withSidecar('e2'))
		await flushPromises()
		cull.undo()

		expect(cull.decisionOf(picture('IMG_2')).flag).toBe('picked')
		expect(flags.saves).toEqual([[{ fileId: 1, flag: 'picked', keepRaw: false }]])
		expect(flags.etagSaves).toEqual([[{ fileId: 1, sidecarEtag: 'e2' }]])
		expect(writes).toEqual([])
	})

	// spec: XMP-003.48
	it.each([['unchanged', 's1'], ['never known', undefined]])('writes the row\'s flag to a sidecar whose ETag is %s', async (_case, etag) => {
		const { cull, writes, flags, open, picture } = cullWith({ writeFlags: true, stored: [stored(1, 'picked')], etags: etag === undefined ? {} : { 1: etag }, takenOver: Promise.resolve(new Map([['IMG_2', REJECTED]])), rows: [sidecarRow('s1', 'rejected')] })

		open(SET, withSidecar('s1'))
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_2')).flag).toBe('picked')
		expect(flags.saves).toEqual([])
		expect(writes.map((write) => write.map(({ name, decision, fields }) => [name, decision.flag, fields]))).toEqual([[['IMG_2', 'picked', ['flag', 'keepRaw']]]])
	})

	// spec: XMP-003.49
	it.each([
		['read-only', { listed: access({ '/Trip/B': 1 }) }],
		['refused', { state: 'refused' as const }],
		['off', { off: true }],
	])('neither takes over nor writes a %s picture', async (_case, { listed, state, off }: { listed?: ReturnType<typeof access>, state?: 'refused', off?: boolean }) => {
		const { cull, writes, flags, open, picture } = cullWith({ writeFlags: off !== true, stored: [stored(1, 'rejected')], etags: { 1: 'e1' }, takenOver: Promise.resolve(new Map([['IMG_2', PICKED]])), rows: [sidecarRow('e2', 'picked', state)] })

		open(SET, withSidecar('e2'), listed)
		await flushPromises()

		expect(cull.decisionOf(picture('IMG_2')).flag).toBe('rejected')
		expect(flags.saves).toEqual([])
		expect(writes).toEqual([])
	})
})
