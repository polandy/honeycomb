// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ArrayKind, XmpFields, XmpNode, XmpPacket } from './model.ts'

import { NAMESPACE, textNode, XmpError, xmpKey } from './model.ts'

/** The name of an element or attribute as the file wrote it. */
export interface XmlName {
	readonly namespace: string
	readonly prefix: string
	readonly local: string
}

/** A parsed element: its attributes without namespace declarations, child elements and text. */
export interface XmlElement {
	readonly name: XmlName
	readonly attributes: readonly { readonly name: XmlName, readonly value: string }[]
	readonly children: readonly XmlElement[]
	readonly text: string
}

type Fields = Map<string, XmpNode>

const ARRAY_KINDS: readonly string[] = ['Bag', 'Seq', 'Alt'] satisfies ArrayKind[]
const META_ROOTS = ['xmpmeta', 'xapmeta']
const IGNORED_RDF_ATTRIBUTES = ['about', 'ID', 'nodeID']
const PROPERTY_RDF_ATTRIBUTES = ['parseType', 'resource', 'value', 'ID', 'nodeID']
const RDF_VALUE = xmpKey(NAMESPACE.rdf, 'value')
const LANGUAGE = xmpKey(NAMESPACE.xml, 'lang')

/** Reads every RDF form of ISO 16684-1 into one model (CORE-009 "Reading"). */
export function packetOf(root: XmlElement): XmpPacket {
	const rdf = rdfElement(root)
	const prefixes = new Map<string, string>()
	const properties: Fields = new Map()
	for (const description of rdf.children) {
		if (!isRdf(description, 'Description')) {
			throw unexpected(description, 'in rdf:RDF')
		}
		readDescription(description, properties, true, prefixes)
	}
	noText(rdf)
	return { properties, prefixes }
}

/** The `rdf:RDF` element of an `x:xmpmeta` or bare root. */
function rdfElement(root: XmlElement): XmlElement {
	if (isRdf(root, 'RDF')) {
		return root
	}
	if (root.name.namespace !== NAMESPACE.x || !META_ROOTS.includes(root.name.local)) {
		throw notXmp(`the root element is ${qualified(root.name)}, not x:xmpmeta or rdf:RDF`)
	}
	const [rdf, ...others] = root.children
	if (rdf === undefined || others.length > 0 || !isRdf(rdf, 'RDF') || hasText(root)) {
		throw notXmp(`${qualified(root.name)} must hold exactly one rdf:RDF`)
	}
	return rdf
}

/** Reads the properties of an `rdf:Description` from its attributes and children. */
function readDescription(description: XmlElement, fields: Fields, topLevel: boolean, prefixes: Map<string, string>): void {
	for (const { name, value } of description.attributes) {
		if ((name.namespace === NAMESPACE.rdf && IGNORED_RDF_ATTRIBUTES.includes(name.local)) || name.namespace === NAMESPACE.xml) {
			continue
		}
		if (name.namespace === NAMESPACE.rdf && (topLevel || name.local !== 'value')) {
			throw notXmp(`unexpected attribute ${qualified(name)}`)
		}
		insert(fields, name, textNode(value), prefixes)
	}
	readChildren(description, fields, topLevel, prefixes)
}

/** Reads the child elements of a description or resource as properties. */
function readChildren(parent: XmlElement, fields: Fields, topLevel: boolean, prefixes: Map<string, string>): void {
	for (const child of parent.children) {
		if (child.name.namespace === NAMESPACE.rdf && (topLevel || child.name.local !== 'value')) {
			throw unexpected(child, 'as a property')
		}
		insert(fields, child.name, readProperty(child, prefixes), prefixes)
	}
	noText(parent)
}

/** Reads a property element with its `xml:lang`. */
function readProperty(element: XmlElement, prefixes: Map<string, string>): XmpNode {
	const node = readValue(element, prefixes)
	const language = element.attributes.find(({ name }) => name.namespace === NAMESPACE.xml && name.local === 'lang')
	return language ? { value: node.value, qualifiers: new Map([...node.qualifiers, [LANGUAGE, textNode(language.value)]]) } : node
}

/** Reads the value of a property element in any of its forms. */
function readValue(element: XmlElement, prefixes: Map<string, string>): XmpNode {
	const unknown = element.attributes.find(({ name }) => name.namespace === NAMESPACE.rdf && !PROPERTY_RDF_ATTRIBUTES.includes(name.local))
	if (unknown) {
		throw notXmp(`unexpected attribute ${qualified(unknown.name)} on ${qualified(element.name)}`)
	}
	const fieldAttributes = element.attributes.filter(({ name }) => name.namespace !== NAMESPACE.xml && (name.namespace !== NAMESPACE.rdf || name.local === 'value'))
	const parseType = rdfAttribute(element, 'parseType')
	if (parseType !== undefined) {
		if (parseType !== 'Resource') {
			throw notXmp(`rdf:parseType="${parseType}" on ${qualified(element.name)} is not XMP`)
		}
		if (fieldAttributes.length > 0) {
			throw unexpectedContent(element)
		}
		const fields: Fields = new Map()
		readChildren(element, fields, false, prefixes)
		return resource(fields)
	}
	const fields: Fields = new Map()
	for (const { name, value } of fieldAttributes) {
		insert(fields, name, textNode(value), prefixes)
	}
	const uri = rdfAttribute(element, 'resource')
	if (uri !== undefined || fields.size > 0) {
		if (element.children.length > 0 || hasText(element)) {
			throw unexpectedContent(element)
		}
		return uri === undefined ? resource(fields) : { value: { kind: 'uri', uri }, qualifiers: fields }
	}
	const [child, ...others] = element.children
	if (child === undefined) {
		return textNode(element.text)
	}
	if (others.length > 0 || hasText(element)) {
		throw unexpectedContent(element)
	}
	return readNested(element, child, prefixes)
}

/** Reads a nested `rdf:Description` or an array. */
function readNested(parent: XmlElement, child: XmlElement, prefixes: Map<string, string>): XmpNode {
	if (isRdf(child, 'Description')) {
		const fields: Fields = new Map()
		readDescription(child, fields, false, prefixes)
		return resource(fields)
	}
	if (child.name.namespace !== NAMESPACE.rdf || !ARRAY_KINDS.includes(child.name.local)) {
		throw unexpected(child, `in ${qualified(parent.name)}`)
	}
	const items = child.children.map((item) => {
		if (!isRdf(item, 'li')) {
			throw unexpected(item, `in ${qualified(child.name)}`)
		}
		return readProperty(item, prefixes)
	})
	noText(child)
	return { value: { kind: 'array', array: child.name.local as ArrayKind, items }, qualifiers: new Map() }
}

/** Adds a field, refusing a second different value, and records the file's prefix. */
function insert(fields: Fields, name: XmlName, node: XmpNode, prefixes: Map<string, string>): void {
	if (name.namespace === '') {
		throw notXmp(`${qualified(name)} is in no namespace`)
	}
	if (name.prefix !== '' && !prefixes.has(name.namespace)) {
		prefixes.set(name.namespace, name.prefix)
	}
	const key = xmpKey(name.namespace, name.local)
	const existing = fields.get(key)
	if (existing !== undefined && !sameNode(existing, node)) {
		throw new XmpError('conflict', `conflicting values for ${qualified(name)}`)
	}
	fields.set(key, node)
}

/** A struct, or the `rdf:value` with the other fields as its qualifiers. */
function resource(fields: Fields): XmpNode {
	const value = fields.get(RDF_VALUE)
	if (value === undefined) {
		return { value: { kind: 'struct', fields }, qualifiers: new Map() }
	}
	fields.delete(RDF_VALUE)
	return { value: value.value, qualifiers: new Map([...value.qualifiers, ...fields]) }
}

/** Whether two nodes are the same value with the same qualifiers. */
function sameNode(left: XmpNode, right: XmpNode): boolean {
	return sameFields(left.qualifiers, right.qualifiers) && sameValue(left.value, right.value)
}

/** Whether two values are equal, item by item and field by field. */
function sameValue(left: XmpNode['value'], right: XmpNode['value']): boolean {
	switch (left.kind) {
		case 'text':
			return right.kind === 'text' && left.text === right.text
		case 'uri':
			return right.kind === 'uri' && left.uri === right.uri
		case 'struct':
			return right.kind === 'struct' && sameFields(left.fields, right.fields)
		case 'array':
			return right.kind === 'array' && left.array === right.array && left.items.length === right.items.length
				&& left.items.every((item, index) => sameNode(item, right.items[index] as XmpNode))
	}
}

/** Whether two field maps hold the same keys with the same nodes. */
function sameFields(left: XmpFields, right: XmpFields): boolean {
	return left.size === right.size && [...left].every(([key, node]) => {
		const other = right.get(key)
		return other !== undefined && sameNode(node, other)
	})
}

/** The value of an `rdf:` attribute of an element. */
function rdfAttribute(element: XmlElement, local: string): string | undefined {
	return element.attributes.find(({ name }) => name.namespace === NAMESPACE.rdf && name.local === local)?.value
}

/** Whether an element is the given `rdf:` element. */
function isRdf(element: XmlElement, local: string): boolean {
	return element.name.namespace === NAMESPACE.rdf && element.name.local === local
}

/** Whether an element holds text other than white space. */
function hasText(element: XmlElement): boolean {
	return element.text.trim() !== ''
}

/** Refuses an element that holds text other than white space. */
function noText(element: XmlElement): void {
	if (hasText(element)) {
		throw unexpectedContent(element)
	}
}

/** A name as the file wrote it, for messages. */
function qualified(name: XmlName): string {
	return name.prefix === '' ? name.local : `${name.prefix}:${name.local}`
}

/** The refusal of an element in the wrong place. */
function unexpected(element: XmlElement, place: string): XmpError {
	return notXmp(`unexpected element ${qualified(element.name)} ${place}`)
}

/** The refusal of an element whose forms do not fit together. */
function unexpectedContent(element: XmlElement): XmpError {
	return notXmp(`${qualified(element.name)} mixes forms or holds unexpected content`)
}

/** The refusal of well-formed XML that is not XMP. */
function notXmp(message: string): XmpError {
	return new XmpError('not-xmp', message)
}
