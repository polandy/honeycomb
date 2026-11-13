// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpPacket } from '../../../../src/logic/xmp/model.ts'

import { describe, expect, it } from 'vitest'
import { NAMESPACE, xmpKey } from '../../../../src/logic/xmp/model.ts'
import { readXmp } from '../../../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../../../src/logic/xmp/serialize.ts'
import { mergeTags, pictureTags, sidecarTags, tagWrite } from '../../../../src/logic/xmp/tags.ts'
import { arrayKindOf, bag, CANONICAL_TIME, fixtureBytes, itemsOf, key, packetOf, seq } from './xmp-builders.ts'

const TAG_FIELDS = ['digiKam:TagsList', 'lr:hierarchicalSubject', 'dc:subject'].map(key)
const LAST_KEYWORD = xmpKey('http://ns.microsoft.com/photo/1.0/', 'LastKeywordXMP')

/** A packet holding the given tags in all three fields, as honeycomb writes them. */
function tagged(tags: readonly string[], keywords: readonly string[] = tags.map((tag) => tag.split('/').at(-1)!)): XmpPacket {
	return packetOf({
		'digiKam:TagsList': seq(tags),
		'lr:hierarchicalSubject': bag(tags.map((tag) => tag.replaceAll('/', '|'))),
		'dc:subject': bag(keywords),
	})
}

/** The properties a tag write leaves alone. */
function untouched(packet: XmpPacket): Map<string, unknown> {
	return new Map([...packet.properties].filter(([name]) => !TAG_FIELDS.includes(name)))
}

describe('sidecarTags', () => {
	// spec: XMP-004.3
	it('takes TagsList over the other fields', () => {
		const packet = packetOf({
			'digiKam:TagsList': seq(['Places/Lisbon']),
			'lr:hierarchicalSubject': bag(['People|Anna']),
			'dc:subject': bag(['sunset']),
		})
		expect(sidecarTags(packet)).toEqual(['Places/Lisbon'])
	})

	// spec: XMP-004.3
	it('passes over an empty field', () => {
		const packet = packetOf({
			'digiKam:TagsList': seq([]),
			'lr:hierarchicalSubject': bag(['People|Anna', 'Places|Lisbon']),
			'dc:subject': bag(['sunset']),
		})
		expect(sidecarTags(packet)).toEqual(['People/Anna', 'Places/Lisbon'])
	})

	// spec: XMP-004.3
	it('reads each dc:subject keyword as a tag without parents', () => {
		expect(sidecarTags(packetOf({ 'dc:subject': bag(['sunset', 'Lisbon']) }))).toEqual(['Lisbon', 'sunset'])
	})

	it('has no tags without a tag field', () => {
		expect(sidecarTags(packetOf({ 'xmp:Rating': '3' }))).toEqual([])
	})

	// spec: XMP-004.4
	it.each([
		['digiKam:TagsList', 'Places/Lake | Shore', 'Places/Lake \\ Shore'],
		['lr:hierarchicalSubject', 'People|AC/DC', 'People/AC\\DC'],
		['dc:subject', 'a/b', 'a\\b'],
		['dc:subject', 'a|b', 'a\\b'],
		['digiKam:TagsList', '  Places / Lisbon ', 'Places/Lisbon'],
		['digiKam:TagsList', 'a//b', 'a/b'],
	])('reads %s %j as %j', (field, item, tag) => {
		expect(sidecarTags(packetOf({ [field]: bag([item]) }))).toEqual([tag])
	})

	// spec: XMP-004.4
	it('skips an item without a name and an item that is not text', () => {
		const struct = { value: { kind: 'struct', fields: new Map() }, qualifiers: new Map() } as const
		const list = { value: { kind: 'array', array: 'Seq', items: [struct, ...seq(['/', 'Anna']).value.items] }, qualifiers: new Map() } as const
		expect(sidecarTags(packetOf({ 'digiKam:TagsList': list }))).toEqual(['Anna'])
	})

	// spec: XMP-004.4
	it('reads a field of one text as one item', () => {
		expect(sidecarTags(packetOf({ 'dc:subject': 'sunset' }))).toEqual(['sunset'])
	})

	it('reads the digiKam fixture', () => {
		expect(sidecarTags(readXmp(fixtureBytes('digikam.xmp')))).toEqual(['Places/Lisbon'])
	})
})

describe('pictureTags', () => {
	// spec: XMP-004.5
	it('unites the tags of every source, each once, sorted', () => {
		const raw = tagged(['Places/Lisbon'])
		const jpeg = tagged(['People/Anna'])
		const embedded = packetOf({ 'dc:subject': bag(['Lisbon']), 'digiKam:TagsList': seq(['Places/Lisbon']) })
		expect(pictureTags([raw, jpeg, embedded])).toEqual(['People/Anna', 'Places/Lisbon'])
	})

	it('has no tags without sources', () => {
		expect(pictureTags([])).toEqual([])
	})
})

describe('tagWrite', () => {
	// spec: XMP-004.6
	it('applies the change to the tags the sources hold now', () => {
		const listed = tagged(['Places/Lisbon'])
		const changedSinceListing = tagged(['People/Anna', 'Places/Lisbon'])
		const write = tagWrite([listed, changedSinceListing], { added: ['Events/Wedding'], removed: ['Places/Lisbon'] })
		expect(write.tags).toEqual(['Events/Wedding', 'People/Anna'])
		for (const sidecar of [listed, changedSinceListing]) {
			expect(itemsOf(mergeTags(sidecar, write), 'digiKam:TagsList')).toEqual(['Events/Wedding', 'People/Anna'])
		}
	})

	it('adds a tag the sources already hold only once', () => {
		expect(tagWrite([tagged(['Anna'])], { added: ['Anna'], removed: [] }).tags).toEqual(['Anna'])
	})
})

describe('mergeTags', () => {
	// spec: XMP-004.7
	it('writes TagsList, hierarchicalSubject and dc:subject, read back unchanged', () => {
		const write = tagWrite([], { added: ['Places/Italy/Dolomites', 'People/Anna'], removed: [] })
		const merged = readXmp(serializeXmp(mergeTags(packetOf({}), write), CANONICAL_TIME))
		expect(arrayKindOf(merged, 'digiKam:TagsList')).toBe('Seq')
		expect(itemsOf(merged, 'digiKam:TagsList')).toEqual(['People/Anna', 'Places/Italy/Dolomites'])
		expect(arrayKindOf(merged, 'lr:hierarchicalSubject')).toBe('Bag')
		expect(itemsOf(merged, 'lr:hierarchicalSubject')).toEqual(['People|Anna', 'Places|Italy|Dolomites'])
		expect(arrayKindOf(merged, 'dc:subject')).toBe('Bag')
		expect(itemsOf(merged, 'dc:subject')).toEqual(['Anna', 'Dolomites'])
		expect(sidecarTags(merged)).toEqual(['People/Anna', 'Places/Italy/Dolomites'])
	})

	// spec: XMP-004.8
	it('keeps foreign keywords in their order and drops the leaf of a removed tag', () => {
		const sidecar = tagged(['People/Anna', 'Places/Lisbon'], ['sunset', 'Anna', 'Lisbon'])
		const merged = mergeTags(sidecar, tagWrite([sidecar], { added: [], removed: ['Places/Lisbon'] }))
		expect(itemsOf(merged, 'dc:subject')).toEqual(['sunset', 'Anna'])
	})

	// spec: XMP-004.8
	it('keeps a leaf another tag still has', () => {
		const sidecar = tagged(['People/Anna', 'Pets/Anna'])
		const merged = mergeTags(sidecar, tagWrite([sidecar], { added: [], removed: ['Pets/Anna'] }))
		expect(itemsOf(merged, 'dc:subject')).toEqual(['Anna'])
		expect(itemsOf(merged, 'digiKam:TagsList')).toEqual(['People/Anna'])
	})

	// spec: XMP-004.9
	it('removes the path fields and keeps only foreign keywords when no tag is left', () => {
		const sidecar = tagged(['Places/Lisbon'], ['sunset', 'Lisbon'])
		const merged = mergeTags(sidecar, tagWrite([sidecar], { added: [], removed: ['Places/Lisbon'] }))
		expect(merged.properties.has(key('digiKam:TagsList'))).toBe(false)
		expect(merged.properties.has(key('lr:hierarchicalSubject'))).toBe(false)
		expect(itemsOf(merged, 'dc:subject')).toEqual(['sunset'])
	})

	// spec: XMP-004.9
	it('removes dc:subject when no keyword is left', () => {
		const sidecar = tagged(['Places/Lisbon'])
		const merged = mergeTags(sidecar, tagWrite([sidecar], { added: [], removed: ['Places/Lisbon'] }))
		expect(TAG_FIELDS.filter((field) => merged.properties.has(field))).toEqual([])
	})

	// spec: XMP-004.10
	it('leaves every other property alone, the Microsoft keyword field included', () => {
		const fixture = readXmp(fixtureBytes('digikam.xmp'))
		const properties = new Map(fixture.properties).set(LAST_KEYWORD, bag(['Places/Lisbon']))
		const sidecar = { properties, prefixes: fixture.prefixes }
		const merged = mergeTags(sidecar, tagWrite([sidecar], { added: ['People/Anna'], removed: ['Places/Lisbon'] }))
		expect(untouched(merged)).toEqual(untouched(sidecar))
		expect(merged.prefixes).toBe(sidecar.prefixes)
		expect(merged.properties.has(xmpKey(NAMESPACE.digiKam, 'TagsList'))).toBe(true)
	})
})
