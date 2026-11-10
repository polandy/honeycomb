// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpTime } from '../../../../src/logic/xmp/model.ts'

import { describe, expect, it } from 'vitest'
import { NAMESPACE, xmpKey } from '../../../../src/logic/xmp/model.ts'
import { readXmp } from '../../../../src/logic/xmp/parse.ts'
import { serializeXmp } from '../../../../src/logic/xmp/serialize.ts'
import { CANONICAL_TIME, fixtureBytes, fixtureText, key, packetOf, seq, text, textOf } from './xmp-builders.ts'

/** The text of a serialized packet. */
function serialized(...args: Parameters<typeof serializeXmp>): string {
	return new TextDecoder('utf-8', { ignoreBOM: true }).decode(serializeXmp(...args))
}

describe('serializeXmp', () => {
	// spec: XMP-001.17
	it('writes the model of canonical.xmp as its exact bytes', () => {
		expect(serialized(readXmp(fixtureBytes('forms/split.xmp')), CANONICAL_TIME)).toBe(fixtureText('canonical.xmp'))
		expect(serializeXmp(readXmp(fixtureBytes('canonical.xmp')), CANONICAL_TIME)).toEqual(fixtureBytes('canonical.xmp'))
	})

	// spec: XMP-001.17
	it('keeps xmp:CreatorTool and adds neither xmp:ModifyDate nor xmpMM:History', () => {
		const written = readXmp(serializeXmp(packetOf({ 'xmp:CreatorTool': 'darktable' }), CANONICAL_TIME))
		expect(textOf(written, 'xmp:CreatorTool')).toBe('darktable')
		expect(textOf(written, 'xmp:MetadataDate')).toBe('2026-11-08T14:03:12+01:00')
		expect(written.properties.has(key('xmp:ModifyDate'))).toBe(false)
		expect(written.properties.has(key('xmpMM:History'))).toBe(false)
	})

	// spec: XMP-001.17
	it.each([
		[{ epochMs: Date.UTC(2026, 0, 1, 1, 30, 5, 999), offsetMinutes: -150 }, '2025-12-31T23:00:05-02:30'],
		[{ epochMs: Date.UTC(2026, 5, 30, 22, 0, 0), offsetMinutes: 120 }, '2026-07-01T00:00:00+02:00'],
		[{ epochMs: Date.UTC(1999, 11, 31, 23, 59, 59), offsetMinutes: 0 }, '1999-12-31T23:59:59+00:00'],
	])('sets xmp:MetadataDate from %j with seconds and offset', (time: XmpTime, date) => {
		expect(textOf(readXmp(serializeXmp(packetOf({}), time)), 'xmp:MetadataDate')).toBe(date)
	})

	it('refuses a time an XMP date cannot hold', () => {
		expect(() => serializeXmp(packetOf({}), { epochMs: Date.UTC(10000, 0, 1), offsetMinutes: 0 })).toThrow(RangeError)
	})

	// spec: XMP-001.18
	it('writes the same bytes whatever order the properties were set in', () => {
		const forward = packetOf({ 'xmp:Rating': '2', 'dc:subject': seq(['a']), 'digiKam:PickLabel': '3' })
		const backward = packetOf({ 'digiKam:PickLabel': '3', 'dc:subject': seq(['a']), 'xmp:Rating': '2' })
		expect(serializeXmp(forward, CANONICAL_TIME)).toEqual(serializeXmp(backward, CANONICAL_TIME))
	})

	// spec: XMP-001.19
	it('uses dc for Dublin Core, keeps an unknown prefix and renames a clashing one', () => {
		const written = serialized(readXmp(fixtureBytes('prefixes.xmp')), CANONICAL_TIME)
		expect(written).toBe(fixtureText('prefixes-written.xmp'))
		const reread = readXmp(new TextEncoder().encode(written)).properties
		expect(new Map([...reread].filter(([name]) => name !== key('xmp:MetadataDate')))).toEqual(readXmp(fixtureBytes('prefixes.xmp')).properties)
	})

	it('names an unknown namespace without a usable prefix ns', () => {
		const packet = { properties: new Map([[xmpKey('https://a.example/', 'One'), text('1')], [xmpKey('https://b.example/', 'Two'), text('2')]]), prefixes: new Map([['https://b.example/', 'xmlish']]) }
		const written = serialized(packet, CANONICAL_TIME)
		expect(written).toContain('xmlns:ns="https://a.example/"')
		expect(written).toContain('xmlns:ns1="https://b.example/"')
		expect(readXmp(new TextEncoder().encode(written)).properties.get(xmpKey('https://b.example/', 'Two'))).toEqual(text('2'))
	})

	it('escapes text and attribute values so they read back as written', () => {
		const tricky = 'a & b < c > d "e"\ttab\nline\rreturn'
		const packet = packetOf({
			'dc:description': text(tricky, new Map([[xmpKey(NAMESPACE.xml, 'lang'), text(tricky)]])),
		})
		expect(readXmp(serializeXmp(packet, CANONICAL_TIME)).properties.get(key('dc:description'))).toEqual(packet.properties.get(key('dc:description')))
	})

	it('writes empty structs, arrays and values in a form that reads back', () => {
		const written = serialized(readXmp(fixtureBytes('unknown-fields.xmp')), CANONICAL_TIME)
		expect(written).toContain('<Iptc4xmpCore:CreatorContactInfo rdf:parseType="Resource"/>')
		expect(written).toContain('<acme:Empty></acme:Empty>')
		expect(written).toContain('<rdf:Seq/>')
		expect(written).toContain('<acme:Link rdf:resource="https://acme.example/pier"/>')
	})
})
