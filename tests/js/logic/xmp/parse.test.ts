// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpNode } from '../../../../src/logic/xmp/model.ts'

import { describe, expect, it } from 'vitest'
import { NAMESPACE, XmpError, xmpKey } from '../../../../src/logic/xmp/model.ts'
import { readableXmp, readXmp } from '../../../../src/logic/xmp/parse.ts'
import expected from '../../../fixtures/xmp/expected.json' with { type: 'json' }
import { fixtureBytes, fixtureText, key, text } from './xmp-builders.ts'

const IPTC = 'http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/'
const ACME = 'https://acme.example/ns/1.0/'

const CANONICAL_MODEL = new Map<string, XmpNode>([
	[key('xmp:Rating'), text('4')],
	[key('dc:title'), { value: { kind: 'array', array: 'Alt', items: [text('Lisbon harbour', new Map([[xmpKey(NAMESPACE.xml, 'lang'), text('x-default')]]))] }, qualifiers: new Map() }],
	[key('dc:subject'), { value: { kind: 'array', array: 'Bag', items: [text('Beach'), text('Sea')] }, qualifiers: new Map() }],
	[xmpKey(IPTC, 'CreatorContactInfo'), {
		value: { kind: 'struct', fields: new Map([[xmpKey(IPTC, 'CiAdrCity'), text('Lisbon')], [xmpKey(IPTC, 'CiEmailWork'), text('photos@example.org')]]) },
		qualifiers: new Map(),
	}],
])

/** The refusal of reading the bytes. */
function refusal(bytes: Uint8Array): XmpError {
	try {
		readXmp(bytes)
	} catch (error) {
		if (error instanceof XmpError) {
			return error
		}
		throw error
	}
	throw new Error('the sidecar was not refused')
}

/** The bytes of a text in UTF-8. */
function utf8(source: string): Uint8Array {
	return new TextEncoder().encode(source)
}

/** A packet with one rdf:Description holding the given body. */
function described(body: string, attributes = ''): Uint8Array {
	return utf8(`<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="${NAMESPACE.rdf}"><rdf:Description rdf:about="" xmlns:acme="${ACME}"${attributes}>${body}</rdf:Description></rdf:RDF></x:xmpmeta>`)
}

describe('readXmp', () => {
	it('reads the elements form as the XMP data model', () => {
		expect(readXmp(fixtureBytes('forms/elements.xmp')).properties).toEqual(CANONICAL_MODEL)
	})

	// spec: XMP-001.1
	it.each(['attributes', 'nested-description', 'value-qualifier', 'split'])('reads the %s form as the same model as the elements form', (form) => {
		expect(readXmp(fixtureBytes(`forms/${form}.xmp`)).properties).toEqual(CANONICAL_MODEL)
	})

	// spec: XMP-001.2
	it.each(['xpacket-wrapper', 'bare-rdf-bom'])('reads the %s form as the same model as x:xmpmeta without a wrapper', (form) => {
		expect(readXmp(fixtureBytes(`forms/${form}.xmp`)).properties).toEqual(CANONICAL_MODEL)
	})

	it('reads a URI, a qualified struct field and an empty value', () => {
		const properties = readXmp(fixtureBytes('unknown-fields.xmp')).properties
		const location = properties.get(xmpKey(ACME, 'Location'))
		expect(location?.value.kind === 'struct' && location.value.fields.get(xmpKey(ACME, 'Link'))).toEqual({ value: { kind: 'uri', uri: 'https://acme.example/pier' }, qualifiers: new Map() })
		expect(location?.value.kind === 'struct' && location.value.fields.get(xmpKey(ACME, 'Code'))).toEqual(text('LIS', new Map([[xmpKey(ACME, 'Scheme'), text('IATA')]])))
		expect(properties.get(xmpKey(ACME, 'Batch'))).toEqual(text('  42 & more  '))
		expect(properties.get(xmpKey(ACME, 'Empty'))).toEqual(text(''))
	})

	it('keeps the prefix the file gives a namespace', () => {
		expect(readXmp(fixtureBytes('prefixes.xmp')).prefixes).toEqual(new Map([
			[NAMESPACE.dc, 'd'],
			[ACME, 'acme'],
			['https://other.example/dc/', 'dc'],
		]))
	})

	it('accepts the same value given twice', () => {
		expect(readXmp(described('<acme:Batch>1</acme:Batch>', ' acme:Batch="1"')).properties).toEqual(new Map([[xmpKey(ACME, 'Batch'), text('1')]]))
	})

	it.each([
		['a URI', '<acme:V rdf:resource="a:1"/>', '<acme:V rdf:resource="a:2"/>'],
		['a struct', '<acme:V acme:X="1"/>', '<acme:V acme:X="2"/>'],
		['a struct with other fields', '<acme:V acme:X="1"/>', '<acme:V acme:Y="1"/>'],
		['an array', '<acme:V><rdf:Seq><rdf:li>1</rdf:li></rdf:Seq></acme:V>', '<acme:V><rdf:Seq><rdf:li>2</rdf:li></rdf:Seq></acme:V>'],
		['an array kind', '<acme:V><rdf:Seq/></acme:V>', '<acme:V><rdf:Bag/></acme:V>'],
		['a value kind', '<acme:V>1</acme:V>', '<acme:V rdf:resource="a:1"/>'],
	])('accepts %s given twice and refuses two different ones', (_, value, other) => {
		const twice = (second: string) => utf8(`<rdf:RDF xmlns:rdf="${NAMESPACE.rdf}"><rdf:Description xmlns:acme="${ACME}">${value}</rdf:Description><rdf:Description xmlns:acme="${ACME}">${second}</rdf:Description></rdf:RDF>`)
		expect(readXmp(twice(value)).properties.size).toBe(1)
		expect(refusal(twice(other)).reason).toBe('conflict')
	})

	// spec: XMP-001.3
	it('refuses an rdf:Description that is not closed with the line and column', () => {
		const error = refusal(fixtureBytes('refused/unclosed.xmp'))
		expect(error.reason).toBe('malformed')
		expect(error.position).toEqual({ line: 4, column: 30 })
	})

	it('refuses an empty sidecar as malformed', () => {
		expect(refusal(new Uint8Array()).reason).toBe('malformed')
	})

	// spec: XMP-001.4
	it('refuses a document type declaration without expanding its entity', () => {
		const error = refusal(fixtureBytes('refused/doctype.xmp'))
		expect(error.reason).toBe('doctype')
		expect(error.message).toContain('<!DOCTYPE>')
		expect(error.position).toEqual({ line: 2, column: 1 })
	})

	// spec: XMP-001.5
	it.each([
		['UTF-16 with a byte order mark', new Uint8Array([0xFF, 0xFE, ...[...fixtureText('forms/elements.xmp')].flatMap((char) => [char.charCodeAt(0), 0])])],
		['UTF-16 without a byte order mark', new Uint8Array([...fixtureText('forms/elements.xmp')].flatMap((char) => [char.charCodeAt(0), 0]))],
		['an invalid UTF-8 byte', new Uint8Array([...utf8('<x:xmpmeta xmlns:x="adobe:ns:meta/">'), 0xFF, ...utf8('</x:xmpmeta>')])],
	])('refuses %s as not UTF-8', (_, bytes) => {
		expect(refusal(bytes).reason).toBe('not-utf-8')
	})

	// spec: XMP-001.6
	it('refuses two different values of one property naming it', () => {
		const error = refusal(fixtureBytes('conflict.xmp'))
		expect(error.reason).toBe('conflict')
		expect(error.message).toBe(expected['conflict.xmp'].error)
	})

	it.each([
		['a root that is not x:xmpmeta or rdf:RDF', utf8(`<rdf:Description xmlns:rdf="${NAMESPACE.rdf}"/>`)],
		['x:xmpmeta without rdf:RDF', utf8('<x:xmpmeta xmlns:x="adobe:ns:meta/"><x:other/></x:xmpmeta>')],
		['an element in rdf:RDF that is not rdf:Description', utf8(`<rdf:RDF xmlns:rdf="${NAMESPACE.rdf}"><rdf:Bag/></rdf:RDF>`)],
		['text in rdf:RDF', utf8(`<rdf:RDF xmlns:rdf="${NAMESPACE.rdf}">stray</rdf:RDF>`)],
		['an rdf element as a property', described('<rdf:value>1</rdf:value>')],
		['an rdf attribute on the top rdf:Description', described('', ' rdf:value="1"')],
		['a property in no namespace', described('', ' Batch="1"')],
		['an unknown rdf attribute on a property', described('<acme:Batch rdf:datatype="int">1</acme:Batch>')],
		['a parse type other than Resource', described('<acme:Batch rdf:parseType="Literal">1</acme:Batch>')],
		['fields beside rdf:parseType', described('<acme:Batch rdf:parseType="Resource" acme:Field="1"/>')],
		['content beside rdf:resource', described('<acme:Link rdf:resource="https://acme.example/">text</acme:Link>')],
		['content beside field attributes', described('<acme:Point acme:X="1">text</acme:Point>')],
		['two values in one property', described('<acme:Batch><rdf:Bag/><rdf:Seq/></acme:Batch>')],
		['text beside an array', described('<acme:Batch>text<rdf:Bag/></acme:Batch>')],
		['an unknown element as a value', described('<acme:Batch><acme:Other/></acme:Batch>')],
		['an array item that is not rdf:li', described('<acme:Batch><rdf:Bag><acme:Item/></rdf:Bag></acme:Batch>')],
		['text in an array', described('<acme:Batch><rdf:Bag>stray</rdf:Bag></acme:Batch>')],
	])('refuses %s as not XMP', (_, bytes) => {
		expect(refusal(bytes).reason).toBe('not-xmp')
	})

	it('reads a struct with a qualifier through rdf:value in a nested rdf:Description', () => {
		const properties = readXmp(described('<acme:Code><rdf:Description rdf:value="LIS" acme:Scheme="IATA"/></acme:Code>')).properties
		expect(properties.get(xmpKey(ACME, 'Code'))).toEqual(text('LIS', new Map([[xmpKey(ACME, 'Scheme'), text('IATA')]])))
	})

	it('reads a qualified URI', () => {
		const properties = readXmp(described('<acme:Link rdf:resource="https://acme.example/" acme:Kind="home"/>')).properties
		expect(properties.get(xmpKey(ACME, 'Link'))).toEqual({ value: { kind: 'uri', uri: 'https://acme.example/' }, qualifiers: new Map([[xmpKey(ACME, 'Kind'), text('home')]]) })
	})
})

describe('readableXmp', () => {
	it('reads a sidecar and answers null for a refused one', () => {
		expect(readableXmp(fixtureBytes('refused/unclosed.xmp'))).toBeNull()
		expect(readableXmp(fixtureBytes('refused/doctype.xmp'))).toBeNull()
		expect(readableXmp(fixtureBytes('digikam.xmp'))).toEqual(readXmp(fixtureBytes('digikam.xmp')))
	})
})
