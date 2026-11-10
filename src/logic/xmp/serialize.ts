// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpFields, XmpNode, XmpPacket, XmpTime, XmpValue } from './model.ts'

import { NAMESPACE, PREFERRED_PREFIXES, textNode, xmpKey, xmpName } from './model.ts'

/** A start tag; `End` closes the latest open one, and a start directly followed by it is written empty. */
type XmlEvent
	= | { readonly kind: 'start', readonly name: string, readonly attributes: readonly (readonly [string, string])[] }
		| { readonly kind: 'end' }
		| { readonly kind: 'text', readonly text: string }

const INDENT = '  '
const STRUCTURE_PREFIXES = ['x', 'rdf']
const FALLBACK_PREFIX = 'ns'
const LANGUAGE = xmpKey(NAMESPACE.xml, 'lang')
const MAX_YEAR = 9999
const MS_PER_MINUTE = 60_000
const END: XmlEvent = { kind: 'end' }

/** Writes a packet in Framehive's canonical form with `xmp:MetadataDate` at the given time (CORE-009 "Writing"). */
export function serializeXmp(packet: XmpPacket, time: XmpTime): Uint8Array {
	const properties = new Map(packet.properties).set(xmpKey(NAMESPACE.xmp, 'MetadataDate'), textNode(xmpDate(time)))
	const prefixes = choosePrefixes(properties, packet.prefixes)
	const declarations = [...prefixes].map(([namespace, prefix]) => [`xmlns:${prefix}`, namespace] as const)
		.sort(([left], [right]) => compare(left, right))
	const events: XmlEvent[] = [
		start('x:xmpmeta', [['xmlns:x', NAMESPACE.x]]),
		indent(1),
		start('rdf:RDF', [['xmlns:rdf', NAMESPACE.rdf]]),
		indent(2),
		start('rdf:Description', [['rdf:about', ''], ...declarations]),
	]
	writeFields(events, properties, 3, prefixes)
	events.push(END, indent(1), END, indent(0), END)
	return new TextEncoder().encode(`${written(events)}\n`)
}

/** An XMP date with seconds and offset, such as `2026-11-08T14:03:12+01:00`. */
function xmpDate({ epochMs, offsetMinutes }: XmpTime): string {
	const local = new Date(epochMs + offsetMinutes * MS_PER_MINUTE)
	const year = local.getUTCFullYear()
	if (Number.isNaN(year) || year < 0 || year > MAX_YEAR) {
		throw new RangeError(`the time ${epochMs} has a year an XMP date cannot hold`)
	}
	const offset = Math.abs(offsetMinutes)
	return `${pad(year, 4)}-${pad(local.getUTCMonth() + 1)}-${pad(local.getUTCDate())}`
		+ `T${pad(local.getUTCHours())}:${pad(local.getUTCMinutes())}:${pad(local.getUTCSeconds())}`
		+ `${offsetMinutes < 0 ? '-' : '+'}${pad(Math.floor(offset / 60))}:${pad(offset % 60)}`
}

/** A number with leading zeros. */
function pad(value: number, digits = 2): string {
	return String(value).padStart(digits, '0')
}

/** The preferred prefix of known namespaces, the file's own for the rest, made unique by a number. */
function choosePrefixes(properties: XmpFields, filePrefixes: ReadonlyMap<string, string>): Map<string, string> {
	const namespaces = new Set<string>()
	collectNamespaces(properties, namespaces)
	namespaces.delete(NAMESPACE.xml)
	const taken = new Set([...STRUCTURE_PREFIXES, ...PREFERRED_PREFIXES.values()])
	const chosen = new Map<string, string>()
	const unknown: (readonly [string, string])[] = []
	for (const namespace of namespaces) {
		const preferred = PREFERRED_PREFIXES.get(namespace)
		if (preferred === undefined) {
			const own = filePrefixes.get(namespace)
			unknown.push([own !== undefined && !own.toLowerCase().startsWith('xml') ? own : FALLBACK_PREFIX, namespace])
		} else {
			chosen.set(namespace, preferred)
		}
	}
	unknown.sort(([leftPrefix, left], [rightPrefix, right]) => compare(leftPrefix, rightPrefix) || compare(left, right))
	for (const [wanted, namespace] of unknown) {
		let prefix = wanted
		for (let number = 1; taken.has(prefix); number++) {
			prefix = `${wanted}${number}`
		}
		taken.add(prefix)
		chosen.set(namespace, prefix)
	}
	return chosen
}

/** Adds the namespace of every field, qualifier and nested value. */
function collectNamespaces(fields: XmpFields, namespaces: Set<string>): void {
	for (const [key, node] of fields) {
		namespaces.add(xmpName(key).namespace)
		collectNodeNamespaces(node, namespaces)
	}
}

/** Adds the namespaces of a node's qualifiers, struct fields and array items. */
function collectNodeNamespaces(node: XmpNode, namespaces: Set<string>): void {
	collectNamespaces(node.qualifiers, namespaces)
	if (node.value.kind === 'struct') {
		collectNamespaces(node.value.fields, namespaces)
	} else if (node.value.kind === 'array') {
		node.value.items.forEach((item) => collectNodeNamespaces(item, namespaces))
	}
}

/** Writes fields by prefix, then name, each on its own line, then the line break before the parent's end tag. */
function writeFields(events: XmlEvent[], fields: XmpFields, depth: number, prefixes: ReadonlyMap<string, string>): void {
	const named = [...fields].map(([key, node]) => {
		const { namespace, local } = xmpName(key)
		return { prefix: prefixes.get(namespace) ?? '', local, node }
	}).sort((left, right) => compare(left.prefix, right.prefix) || compare(left.local, right.local))
	for (const { prefix, local, node } of named) {
		events.push(indent(depth))
		writeNode(events, `${prefix}:${local}`, node, depth, prefixes)
	}
	if (named.length > 0) {
		events.push(indent(depth - 1))
	}
}

/** Writes a node: language as `xml:lang`, other qualifiers in the `rdf:value` form. */
function writeNode(events: XmlEvent[], name: string, node: XmpNode, depth: number, prefixes: ReadonlyMap<string, string>): void {
	const language = node.qualifiers.get(LANGUAGE)
	const attributes: (readonly [string, string])[] = language?.value.kind === 'text' ? [['xml:lang', language.value.text]] : []
	const qualifiers = new Map(node.qualifiers)
	if (attributes.length > 0) {
		qualifiers.delete(LANGUAGE)
	}
	if (qualifiers.size === 0) {
		writeValue(events, name, attributes, node.value, depth, prefixes)
		return
	}
	events.push(start(name, [...attributes, ['rdf:parseType', 'Resource']]), indent(depth + 1))
	writeValue(events, 'rdf:value', [], node.value, depth + 1, prefixes)
	writeFields(events, qualifiers, depth + 1, prefixes)
	events.push(END)
}

/** Writes a value: text as content, a URI as `rdf:resource`, a struct as a resource, an array with its items. */
function writeValue(events: XmlEvent[], name: string, attributes: readonly (readonly [string, string])[], value: XmpValue, depth: number, prefixes: ReadonlyMap<string, string>): void {
	switch (value.kind) {
		case 'text':
			events.push(start(name, attributes), { kind: 'text', text: value.text })
			break
		case 'uri':
			events.push(start(name, [...attributes, ['rdf:resource', value.uri]]))
			break
		case 'struct':
			events.push(start(name, [...attributes, ['rdf:parseType', 'Resource']]))
			writeFields(events, value.fields, depth + 1, prefixes)
			break
		case 'array':
			events.push(start(name, attributes), indent(depth + 1), start(`rdf:${value.array}`, []))
			for (const item of value.items) {
				events.push(indent(depth + 2))
				writeNode(events, 'rdf:li', item, depth + 2, prefixes)
			}
			if (value.items.length > 0) {
				events.push(indent(depth + 1))
			}
			events.push(END, indent(depth))
			break
	}
	events.push(END)
}

/** The text of the events, escaped. */
function written(events: readonly XmlEvent[]): string {
	const open: (string | null)[] = []
	let text = ''
	events.forEach((event, index) => {
		if (event.kind === 'start') {
			const empty = events[index + 1]?.kind === 'end'
			text += `<${event.name}${event.attributes.map(([name, value]) => ` ${name}="${escapeAttribute(value)}"`).join('')}${empty ? '/>' : '>'}`
			open.push(empty ? null : event.name)
		} else if (event.kind === 'end') {
			const name = open.pop()
			text += name ? `</${name}>` : ''
		} else {
			text += escapeText(event.text)
		}
	})
	return text
}

/** Escapes what would end or change text content. */
function escapeText(text: string): string {
	return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('\r', '&#13;')
}

/** Escapes what attribute-value normalization would change, so the value reads back as written. */
function escapeAttribute(value: string): string {
	return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;')
		.replaceAll('\t', '&#9;').replaceAll('\n', '&#10;').replaceAll('\r', '&#13;')
}

/** A start tag. */
function start(name: string, attributes: readonly (readonly [string, string])[]): XmlEvent {
	return { kind: 'start', name, attributes }
}

/** A line break and the indent of a depth. */
function indent(depth: number): XmlEvent {
	return { kind: 'text', text: `\n${INDENT.repeat(depth)}` }
}

/** Compares by UTF-16 code units, independent of the locale. */
function compare(left: string, right: string): number {
	return left < right ? -1 : (left > right ? 1 : 0)
}
