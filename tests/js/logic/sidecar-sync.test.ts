// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../../src/logic/decision.ts'
import type { ListingEntry } from '../../../src/logic/listing.ts'
import type { Picture } from '../../../src/logic/pairing.ts'
import type { KnownSidecar, SidecarLookupAnswer } from '../../../src/logic/sidecar-sync.ts'

import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../../src/logic/decision.ts'
import { applySaves, inSharedFolder, planSaves, takeOverDecisions, takeOverLookups, writeLookups } from '../../../src/logic/sidecar-sync.ts'
import { readXmp } from '../../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../../src/logic/xmp/serialize.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'
import { CANONICAL_TIME, fixtureBytes, itemsOf, packetOf, seq, textOf } from './xmp/xmp-builders.ts'

const NEF = listingEntry(1, '/P/IMG_0001.NEF')
const JPG = listingEntry(2, '/P/IMG_0001.JPG')
const NEF_XMP = listingEntry(11, '/P/IMG_0001.NEF.xmp')
const JPG_XMP = listingEntry(12, '/P/IMG_0001.JPG.xmp')
const PICKED: Decision = { ...UNDECIDED, rating: 2, flag: 'picked' }

/** The bytes of a sidecar with the properties, each written as `prefix:Name`. */
function xmp(properties: Record<string, string>): Uint8Array {
	return serializeXmp(packetOf(properties), CANONICAL_TIME)
}

/** A `read` lookup answer of the bytes at the mtime. */
function read(bytes: Uint8Array, mtime = 100): SidecarLookupAnswer {
	return { result: 'read', bytes, etag: `etag-${mtime}`, size: bytes.length, mtime }
}

describe('takeOverLookups', () => {
	// spec: XMP-003.2
	it('looks up the sidecars of pictures without a stored decision only', () => {
		const stored = pictureOf(listingEntry(3, '/P/A.JPG'), listingEntry(13, '/P/A.JPG.xmp'))
		const bare = pictureOf(listingEntry(4, '/P/B.JPG'))
		const pair = pictureOf(NEF, JPG, NEF_XMP, listingEntry(14, '/P/IMG_0001_01.NEF.xmp'))

		const lookups = takeOverLookups([stored, bare, pair], new Set([3]))

		expect(lookups.map(({ picture, sidecars }) => [picture.baseName, sidecars.map((entry) => entry.fileId)])).toEqual([['IMG_0001', [11]]])
	})
})

describe('takeOverDecisions', () => {
	const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)

	// spec: XMP-003.1
	it('takes the newest sidecar as a whole, a tie going to the RAW member\'s', () => {
		const lookups = takeOverLookups([pair], new Set())
		const rawSays = xmp({ 'xmp:Rating': '3', 'xmpDM:pick': '-1' })
		const jpgSays = xmp({ 'xmp:Rating': '1' })

		const tie = takeOverDecisions(lookups, new Map([[11, read(rawSays)], [12, read(jpgSays)]]))
		const newer = takeOverDecisions(lookups, new Map([[11, read(rawSays)], [12, read(jpgSays, 200)]]))

		expect(tie.decided).toEqual([{ picture: pair, decision: { rating: 3, colourLabel: null, flag: 'rejected', keepRaw: false } }])
		expect(tie.warnings).toEqual([{ path: '/P/IMG_0001.JPG.xmp', reason: 'disagrees' }])
		expect(newer.decided[0]!.decision.rating).toBe(1)
	})

	// spec: XMP-003.4
	it('takes nothing over from an undecided, refused, unread or missing sidecar and warns', () => {
		const single = (id: number) => pictureOf(listingEntry(id, `/P/S${id}.JPG`), listingEntry(id + 100, `/P/S${id}.JPG.xmp`))
		const lookups = takeOverLookups([single(1), single(2), single(3), single(4)], new Set())

		const { decided, warnings } = takeOverDecisions(lookups, new Map([
			[101, read(xmp({ 'xmp:Rating': '0' }))],
			[102, read(fixtureBytes('refused/doctype.xmp'))],
			[103, { result: 'locked' }],
		]))

		expect(decided).toEqual([])
		expect(warnings).toEqual([
			{ path: '/P/S2.JPG.xmp', reason: 'doctype' },
			{ path: '/P/S3.JPG.xmp', reason: 'locked' },
			{ path: '/P/S4.JPG.xmp', reason: 'unreachable' },
		])
	})
})

describe('writeLookups', () => {
	// spec: XMP-003.6, XMP-003.7
	it('looks up the existing sidecars honeycomb holds no bytes of', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 20, saved: null }]])

		expect(writeLookups(pair, new Map())).toEqual([11])
		expect(writeLookups(pair, known)).toEqual([11, 20])
		expect(writeLookups(pair, known, new Set(['/P/IMG_0001.JPG.xmp']))).toEqual([20])
		expect(writeLookups(pair, new Map([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'e', size: 1, bytes: new Uint8Array() } }]]))).toEqual([])
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
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 22, saved: { etag: 'c', size: 1, bytes: xmp({ 'xmp:Rating': '1' }) } }]])

		const first = planSaves(pair, { decision: PICKED }, new Map(), new Map(), CANONICAL_TIME)
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
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.JPG.xmp', { fileId: 22, saved: { etag: 'c', size: 1, bytes: held } }]])
		const untag = { tags: { added: [], removed: ['Events/Wedding'] } }

		const first = planSaves(pair, WEDDING, new Map(), new Map(), CANONICAL_TIME)
		const last = planSaves(pair, untag, known, new Map(), CANONICAL_TIME)
		const none = planSaves(pair, untag, new Map(), new Map(), CANONICAL_TIME)

		expect(first.saves.map(({ path, item }) => [path, 'path' in item, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.NEF.xmp', true, ['Events/Wedding']], ['/P/IMG_0001.JPG.xmp', true, ['Events/Wedding']]])
		expect(last.saves.map(({ path, item }) => [path, 'fileId' in item, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.JPG.xmp', true, undefined]])
		expect(none.saves).toEqual([])
	})

	// spec: TAGS-002.11
	it('reads the tags of the sidecars it holds when it plans only some paths', () => {
		const pair = pictureOf(NEF, JPG, NEF_XMP, JPG_XMP)
		const held = serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Events/Wedding', 'People/Anna']) }), CANONICAL_TIME)
		const known = new Map<string, KnownSidecar>([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'n', size: 1, bytes: held } }]])
		const changed = new Map([[12, read(serializeXmp(packetOf({ 'digiKam:TagsList': seq(['Kids', 'Places/Lisbon']) }), CANONICAL_TIME))]])

		const { saves } = planSaves(pair, WEDDING, known, changed, CANONICAL_TIME, new Set(['/P/IMG_0001.JPG.xmp']))

		expect(saves.map(({ path, item }) => [path, tagsOf(item.bytes)])).toEqual([['/P/IMG_0001.JPG.xmp', ['Events/Wedding', 'Kids', 'People/Anna']]])
	})
})

describe('applySaves', () => {
	const pair = pictureOf(NEF, JPG, NEF_XMP)
	const plan = planSaves(pair, { decision: PICKED }, new Map(), new Map([[11, read(xmp({}))]]), CANONICAL_TIME).saves

	// spec: XMP-003.7
	it('keeps what was saved so the next write needs no lookup', () => {
		const { known, failed, changed } = applySaves(plan, [{ result: 'saved', fileId: 11, etag: 'n', size: 9, mtime: 1 }, { result: 'saved', fileId: 30, etag: 'm', size: 8, mtime: 1 }], new Map())

		expect([failed, changed]).toEqual([[], []])
		expect(known.get('/P/IMG_0001.NEF.xmp')).toEqual({ fileId: 11, saved: { etag: 'n', size: 9, bytes: plan[0]!.item.bytes } })
		expect(known.get('/P/IMG_0001.JPG.xmp')).toMatchObject({ fileId: 30, saved: { etag: 'm', size: 8 } })
	})

	// spec: XMP-003.8
	it('returns an existing sidecar that changed for another round and forgets its bytes', () => {
		const before = new Map<string, KnownSidecar>([['/P/IMG_0001.NEF.xmp', { fileId: 11, saved: { etag: 'o', size: 1, bytes: new Uint8Array() } }]])

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

describe('inSharedFolder', () => {
	// spec: XMP-003.14
	it('counts a picture with any member in a shared folder', () => {
		const split: Picture<ListingEntry> = { raw: listingEntry(1, '/P/RAW/A.NEF'), rendered: listingEntry(2, '/P/A.JPG'), folder: '/P', baseName: 'A', sidecars: [], ambiguous: false }
		const atRoot = pictureOf(listingEntry(3, '/B.JPG'))

		expect(inSharedFolder(split, new Set(['/P/RAW']))).toBe(true)
		expect(inSharedFolder(split, new Set(['/P/Other']))).toBe(false)
		expect(inSharedFolder(atRoot, new Set(['/']))).toBe(true)
		expect(inSharedFolder(atRoot, new Set())).toBe(false)
	})
})
