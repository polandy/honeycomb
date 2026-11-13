// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Node, ParseError } from '@xmldom/xmldom'
import type { XmlPosition, XmpPacket } from './model.ts'
import type { XmlElement, XmlName } from './rdf.ts'

import { DOMParser, Element, Text } from '@xmldom/xmldom'
import { XmpError } from './model.ts'
import { packetOf } from './rdf.ts'

/** Attributes in this namespace declare namespaces, they are not properties. */
const XMLNS = 'http://www.w3.org/2000/xmlns/'

const DOCTYPE = /<!DOCTYPE/i

/** Reads a sidecar's bytes into the XMP data model, or throws an `XmpError` saying why not (ADR 0016). */
export function readXmp(bytes: Uint8Array): XmpPacket {
	const source = decoded(bytes)
	refuseDoctype(source)
	return packetOf(elementOf(parsed(source)))
}

/** The sidecar's packet, or null when it is refused; any other error is thrown. */
export function readableXmp(bytes: Uint8Array): XmpPacket | null {
	try {
		return readXmp(bytes)
	} catch (error) {
		if (!(error instanceof XmpError)) {
			throw error
		}
		return null
	}
}

/** The text of UTF-8 bytes without a byte order mark. */
function decoded(bytes: Uint8Array): string {
	let source: string
	try {
		source = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
	} catch {
		throw new XmpError('not-utf-8', 'the sidecar is not UTF-8; save it as UTF-8')
	}
	if (source.includes('\u0000')) {
		throw new XmpError('not-utf-8', 'the sidecar holds NUL characters, as UTF-16 does; save it as UTF-8')
	}
	return source
}

/** Refuses a document type declaration before any entity it declares could be expanded. */
function refuseDoctype(source: string): void {
	const match = DOCTYPE.exec(source)
	if (match) {
		throw new XmpError('doctype', 'the sidecar has a document type declaration (<!DOCTYPE>), which XMP does not allow', positionOf(source, match.index))
	}
}

/** The line and column of an offset in a text. */
function positionOf(source: string, offset: number): XmlPosition {
	const before = source.slice(0, offset).split('\n')
	return { line: before.length, column: (before.at(-1)?.length ?? 0) + 1 }
}

/** The root element of well-formed XML; any parser warning or error, a missing root included, refuses the sidecar. */
function parsed(source: string): Element {
	let reported = ''
	const parser = new DOMParser({
		onError: (_level, message) => {
			reported = message
			throw new Error(message)
		},
	})
	try {
		return parser.parseFromString(source, 'application/xml').documentElement as Element
	} catch (error) {
		throw new XmpError('malformed', `the sidecar is not well-formed XML: ${reported}`, locatorPosition((error as ParseError).locator))
	}
}

/** The position xmldom's locator reports; an empty sidecar has no column. */
function locatorPosition(locator: { lineNumber?: number, columnNumber?: number } | undefined): XmlPosition | null {
	const { lineNumber, columnNumber } = locator ?? {}
	return lineNumber !== undefined && columnNumber !== undefined ? { line: lineNumber, column: columnNumber } : null
}

/** Our own tree of an xmldom element, so only this module knows the library. */
function elementOf(element: Element): XmlElement {
	const children: XmlElement[] = []
	let text = ''
	for (const node of Array.from(element.childNodes as Iterable<Node>)) {
		if (node instanceof Element) {
			children.push(elementOf(node))
		} else if (node instanceof Text) {
			text += node.data
		}
	}
	const attributes = Array.from(element.attributes as Iterable<Node>)
		.filter((attribute) => attribute.namespaceURI !== XMLNS)
		.map((attribute) => ({ name: nameOf(attribute), value: attribute.nodeValue ?? '' }))
	return { name: nameOf(element), attributes, children, text }
}

/** The namespace, prefix and local name of an element or attribute. */
function nameOf(node: Node): XmlName {
	return { namespace: node.namespaceURI ?? '', prefix: node.prefix ?? '', local: node.localName ?? node.nodeName }
}
