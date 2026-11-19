// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { KnownSidecar } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { applySaves, planSaves, writeLookups } from '../../../src/logic/sidecar-sync.ts'
import { sidecarDecision } from '../../../src/logic/xmp/decision.ts'
import { readXmp } from '../../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { read, xmp } from './sidecar-answers.ts'
import { CANONICAL_TIME, fixtureBytes, itemsOf, packetOf, seq, textOf } from './xmp/xmp-builders.ts'

const NEF = listingEntry(1, '/P/IMG_0001.NEF')
const JPG = listingEntry(2, '/P/IMG_0001.JPG')
const NEF_XMP = listingEntry(11, '/P/IMG_0001.NEF.xmp')
const JPG_XMP = listingEntry(12, '/P/IMG_0001.JPG.xmp')
const PICKED: Decision = { ...UNDECIDED, rating: 2, flag: 'picked' }
const NO_EMBEDDED = new Map([[JPG.fileId, { result: 'none' as const }]])
const LATER = { ...CANONICAL_TIME, epochMs: CANONICAL_TIME.epochMs + 60_000 }

describe('writeLookups', () => {
	// spec: XMP-003.6, XMP-003.7
	it('looks up the existing sidecars honeycomb holds no bytes of', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 20, saved: null }]])

		expect(writeLookups(pair, new Map())).toEqual([11])
		expect(writeLookups(pair, known)).toEqual([11, 20])
		expect(writeLookups(pair, known, new Set(['/P/IMG_0001.JPG.xmp']))).toEqual([20])
		expect(writeLookups(pair, new Map([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'e', size: 1, mtime: 1, bytes: new Uint8Array() } }]]))).toEqual([])
	})
})

describe('planSaves', () => {
	// spec: XMP-003.6
	it('merges the decision into each existing sidecar with the ETag and size read', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const bytes = xmp({ 'xmp:Rating': '4', 'dc:format': 'kept' })

		const { saves, failed } = planSaves(pair, { decision: PICKED }, new Map(), new Map([[11, read(bytes)], [12, read(bytes, 7)]]), CANONICAL_TIME)

		expect(failed).toEqual([])
		expect(saves.map(({ path, item }) => [path, 'fileId' in item ? [item.fileId, item.etag, item.size] : null])).toEqual([
			['/P/IMG_0001.NEF.xmp', [11, 'etag-100', bytes.length]],
			['/P/IMG_0001.JPG.xmp', [12, 'etag-7', bytes.length]],
		])
		const written = readXmp(saves[0]!.item.bytes)
		expect([textOf(written, 'xmp:Rating'), textOf(written, 'xmpDM:pick'), textOf(written, 'dc:format')]).toEqual(['2', '1', 'kept'])
	})

	// spec: XMP-003.7
	it('creates `<member file>.xmp` for each member without one, and saves over a created one it holds', () => {
		const pair = pictureOf(NEF, JPG)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 22, saved: { etag: 'c', size: 1, mtime: 0, bytes: xmp({ 'xmp:Rating': '1' }) } }]])

		const first = planSaves(pair, { decision: PICKED }, new Map(), new Map(), CANONICAL_TIME, undefined, NO_EMBEDDED)
		const next = planSaves(pair, { decision: PICKED }, known, new Map(), CANONICAL_TIME)

		expect(first.saves.map(({ item }) => ('path' in item ? item.path : item.fileId))).toEqual(['/P/IMG_0001.NEF.xmp', '/P/IMG_0001.JPG.xmp'])
		expect(textOf(readXmp(first.saves[0]!.item.bytes), 'xmp:Rating')).toBe('2')
		expect(next.saves.map(({ item }) => ('path' in item ? item.path : [item.fileId, item.etag]))).toEqual(['/P/IMG_0001.NEF.xmp', [22, 'c']])
	})

	it('replaces darktable\'s colour labels only when the colour label differs from the sidecar\'s', () => {
		const single = pictureOf(listingEntry(5, '/P/D.NEF'), listingEntry(15, '/P/D.NEF.xmp'))
		const answers = new Map([[15, read(fixtureBytes('darktable.xmp'))]])
		const labels = (decision: Decision) => new TextDecoder().decode(planSaves(single, { decision }, new Map(), answers, CANONICAL_TIME).saves[0]!.item.bytes).match(/<darktable:colorlabels>[\s\S]*?<\/darktable:colorlabels>/)?.[0].match(/<rdf:li>\d<\/rdf:li>/g)

		expect(labels({ ...UNDECIDED, colourLabel: 'red', flag: 'rejected' })).toEqual(['<rdf:li>3</rdf:li>', '<rdf:li>0</rdf:li>'])
		expect(labels({ ...UNDECIDED, colourLabel: 'green', flag: 'rejected' })).toEqual(['<rdf:li>2</rdf:li>'])
	})

	// spec: XMP-003.13
	it('reports a refused, an unread and an unanswered sidecar and saves none of them', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const single = pictureOf(listingEntry(6, '/P/E.JPG'), listingEntry(16, '/P/E.JPG.xmp'))

		const refused = planSaves(pair, { decision: PICKED }, new Map(), new Map([[11, read(fixtureBytes('refused/unclosed.xmp'))], [12, { result: 'notPermitted' }]]), CANONICAL_TIME)
		const unanswered = planSaves(single, { decision: PICKED }, new Map(), new Map(), CANONICAL_TIME)

		expect(refused.saves).toEqual([])
		expect(refused.failed).toEqual([
			{ path: '/P/IMG_0001.NEF.xmp', picture: pair, reason: 'malformed' },
			{ path: '/P/IMG_0001.JPG.xmp', picture: pair, reason: 'notPermitted' },
		])
		expect(unanswered.failed).toEqual([{ path: '/P/E.JPG.xmp', picture: single, reason: 'unreachable' }])
	})

	it('plans only the given paths', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)

		const { saves } = planSaves(pair, { decision: PICKED }, new Map(), new Map([[12, read(xmp({}))]]), CANONICAL_TIME, new Set(['/P/IMG_0001.JPG.xmp']))

		expect(saves.map(({ path }) => path)).toEqual(['/P/IMG_0001.JPG.xmp'])
	})

	// spec: XMP-003.17
	it('skips an existing sidecar the edit would not change and saves one it changes', () => {
		const single = pictureOf(NEF, NEF_XMP)
		const stated = planSaves(single, { decision: PICKED }, new Map(), new Map([[11, read(xmp({}))]]), CANONICAL_TIME).saves[0]!.item.bytes
		const answers = new Map([[11, read(stated)]])

		expect(planSaves(single, { decision: PICKED }, new Map(), answers, LATER)).toEqual({ saves: [], failed: [] })
		expect(planSaves(single, { tags: { added: [], removed: ['Places/Lisbon'] } }, new Map(), answers, LATER)).toEqual({ saves: [], failed: [] })
		expect(planSaves(single, { decision: { ...PICKED, rating: 5 } }, new Map(), answers, LATER).saves.map(({ path }) => path)).toEqual(['/P/IMG_0001.NEF.xmp'])
	})

	// spec: XMP-003.20
	it('applies a delta to the decision each sidecar states', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const answers = new Map([[11, read(xmp({ 'xmp:Rating': '4', 'digiKam:ColorLabel': '4' }))], [12, read(xmp({ 'xmp:Rating': '1' }))]])

		const { saves } = planSaves(pair, { decision: { flag: 'picked' } }, new Map(), answers, CANONICAL_TIME)

		expect(saves.map(({ item }) => sidecarDecision(readXmp(item.bytes), true))).toEqual([
			{ ...UNDECIDED, rating: 4, colourLabel: 'green', flag: 'picked' },
			{ ...UNDECIDED, rating: 1, flag: 'picked' },
		])
	})

	// spec: XMP-003.21
	it('starts a new sidecar from what the picture\'s sidecars state, held bytes before read ones', () => {
		const single = pictureOf(NEF, JPG, NEF_XMP)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'n', size: 1, mtime: 300, bytes: xmp({ 'xmp:Rating': '5' }) } }]])
		const created = (saved: ReadonlyMap<string, KnownSidecar>) => planSaves(single, { decision: { flag: 'rejected' } }, saved, new Map([[11, read(xmp({ 'xmp:Rating': '3', 'digiKam:ColorLabel': '1' }))]]), CANONICAL_TIME, undefined, NO_EMBEDDED).saves
			.filter(({ item }) => 'path' in item).map(({ item }) => sidecarDecision(readXmp(item.bytes), true))

		expect(created(new Map())).toEqual([{ ...UNDECIDED, rating: 3, colourLabel: 'red', flag: 'rejected' }])
		expect(created(known)).toEqual([{ ...UNDECIDED, rating: 5, flag: 'rejected' }])
		expect(planSaves(pictureOf(NEF), { decision: { rating: 2 } }, new Map(), new Map(), CANONICAL_TIME).saves.map(({ item }) => sidecarDecision(readXmp(item.bytes), false))).toEqual([{ ...UNDECIDED, rating: 2 }])
	})

	// spec: XMP-003.16
	it('writes a decision and a tag change together in one save per sidecar', () => {
		const single = pictureOf(NEF, NEF_XMP)

		const { saves } = planSaves(single, { decision: PICKED, tags: { added: ['Events/Wedding'], removed: [] } }, new Map(), new Map([[11, read(xmp({}))]]), CANONICAL_TIME)

		expect(saves).toHaveLength(1)
		const written = readXmp(saves[0]!.item.bytes)
		expect([textOf(written, 'xmp:Rating'), itemsOf(written, 'digiKam:TagsList')]).toEqual(['2', ['Events/Wedding']])
	})
})

describe('planSaves: a tag change', () => {
	const WEDDING = { tags: { added: ['Events/Wedding'], removed: ['Places/Lisbon'] } }
	const tagsOf = (bytes: Uint8Array) => itemsOf(readXmp(bytes), 'digiKam:TagsList')

	// spec: TAGS-002.9
	it('applies the change to the union of the sidecars and writes that set to each, leaving the decision', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const answers = new Map([[11, read(serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Places/Lisbon']), 'xmp:Rating': '4' }), CANONICAL_TIME))], [12, read(serializeXmp(packetOf({ 'digiKam:TagsList': seq(['People/Anna']) }), CANONICAL_TIME))]])

		const { saves, failed } = planSaves(pair, WEDDING, new Map(), answers, CANONICAL_TIME)

		expect(failed).toEqual([])
		expect(saves.map(({ item }) => tagsOf(item.bytes))).toEqual([['Events/Wedding', 'People/Anna'], ['Events/Wedding', 'People/Anna']])
		expect([textOf(readXmp(saves[0]!.item.bytes), 'xmp:Rating'), textOf(readXmp(saves[1]!.item.bytes), 'xmp:Rating')]).toEqual(['4', undefined])
	})

	// spec: TAGS-002.10
	it('creates `<member file>.xmp` while tags are left, and saves over a held one without them', () => {
		const pair = pictureOf(NEF, JPG)
		const held = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Events/Wedding']) }), CANONICAL_TIME)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 22, saved: { etag: 'c', size: 1, mtime: 0, bytes: held } }]])
		const untag = { tags: { added: [], removed: ['Events/Wedding'] } }

		const noPacket = new Map([[2, { result: 'none' as const }]])

		const first = planSaves(pair, WEDDING, new Map(), new Map(), CANONICAL_TIME, undefined, noPacket)
		const last = planSaves(pair, untag, known, new Map(), CANONICAL_TIME)
		const none = planSaves(pair, untag, new Map(), new Map(), CANONICAL_TIME, undefined, noPacket)

		expect(first.saves.map(({ path, item }) => [path, 'path' in item, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.NEF.xmp', true, ['Events/Wedding']], ['/P/IMG_0001.JPG.xmp', true, ['Events/Wedding']]])
		expect(last.saves.map(({ path, item }) => [path, 'fileId' in item, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.JPG.xmp', true, undefined]])
		expect(none.saves).toEqual([])
	})

	// spec: TAGS-002.11
	it('reads the tags of the sidecars it holds when it plans only some paths', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const held = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Events/Wedding', 'People/Anna']) }), CANONICAL_TIME)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'n', size: 1, mtime: 0, bytes: held } }]])
		const changed = new Map([[12, read(serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Kids', 'Places/Lisbon']) }), CANONICAL_TIME))]])

		const { saves } = planSaves(pair, WEDDING, known, changed, CANONICAL_TIME, new Set(['/P/IMG_0001.JPG.xmp']))

		expect(saves.map(({ path, item }) => [path, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.JPG.xmp', ['Events/Wedding', 'Kids', 'People/Anna']]])
	})
})

describe('applySaves', () => {
	const pair = pictureOf(NEF, JPG, NEF_XMP)
	const plan = planSaves(pair, { decision: PICKED }, new Map(), new Map([[11, read(xmp({}))]]), CANONICAL_TIME, undefined, NO_EMBEDDED).saves

	// spec: XMP-003.7
	it('keeps what was saved so the next write needs no lookup', () => {
		const { known, failed, changed } = applySaves(plan, [{ result: 'saved', fileId: 11, etag: 'n', size: 9, mtime: 1 }, { result: 'saved', fileId: 30, etag: 'm', size: 8, mtime: 1 }], new Map())

		expect([failed, changed]).toEqual([[], []])
		expect(known.get('/P/IMG_0001.NEF.xmp')).toEqual({ fileId: 11, saved: { etag: 'n', size: 9, mtime: 1, bytes: plan[0]!.item.bytes } })
		expect(known.get('/P/IMG_0001.JPG.xmp')).toMatchObject({ fileId: 30, saved: { etag: 'm', size: 8 } })
	})

	// spec: XMP-003.8
	it('returns an existing sidecar that changed for another round and forgets its bytes', () => {
		const before = new Map<string, KnownSidecar>([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'o', size: 1, mtime: 0, bytes: new Uint8Array() } }]])

		const { known, failed, changed } = applySaves(plan, [{ result: 'changed' }, { result: 'changed' }], before)

		expect(changed).toEqual([plan[0]])
		expect(known.get('/P/IMG_0001.NEF.xmp')).toEqual({ fileId: 11, saved: null })
		expect(failed).toEqual([{ path: '/P/IMG_0001.JPG.xmp', picture: pair, reason: 'changed' }])
	})

	// spec: XMP-003.13
	it('reports each failed save, and every save of a failed request', () => {
		const before = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 30, saved: null }]])

		const answered = applySaves(plan, [{ result: 'locked' }, { result: 'notFound' }], before)
		const unanswered = applySaves(plan, null, new Map())

		expect(answered.failed.map(({ reason }) => reason)).toEqual(['locked', 'notFound'])
		expect([...answered.known]).toEqual([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: null }]])
		expect(unanswered.failed.map(({ reason }) => reason)).toEqual(['unreachable', 'unreachable'])
	})
})
