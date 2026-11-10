// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The namespace URIs honeycomb reads, writes or structures a packet with (`docs/06-xmp-interop.md`). */
export const NAMESPACE = {
	x: 'adobe:ns:meta/',
	rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	xml: 'http://www.w3.org/XML/1998/namespace',
	dc: 'http://purl.org/dc/elements/1.1/',
	xmp: 'http://ns.adobe.com/xap/1.0/',
	xmpMM: 'http://ns.adobe.com/xap/1.0/mm/',
	xmpDM: 'http://ns.adobe.com/xmp/1.0/DynamicMedia/',
	lr: 'http://ns.adobe.com/lightroom/1.0/',
	darktable: 'http://darktable.sf.net/',
	digiKam: 'http://www.digikam.org/ns/1.0/',
	honeycomb: 'https://github.com/polandy/honeycomb/xmp/1.0/',
} as const

/** The prefix written for each known namespace, Framehive's table plus honeycomb's (CORE-009). */
export const PREFERRED_PREFIXES: ReadonlyMap<string, string> = new Map([
	[NAMESPACE.dc, 'dc'],
	[NAMESPACE.xmp, 'xmp'],
	['http://ns.adobe.com/xap/1.0/rights/', 'xmpRights'],
	[NAMESPACE.xmpMM, 'xmpMM'],
	['http://ns.adobe.com/xap/1.0/bj/', 'xmpBJ'],
	['http://ns.adobe.com/xap/1.0/t/pg/', 'xmpTPg'],
	[NAMESPACE.xmpDM, 'xmpDM'],
	['http://ns.adobe.com/xmp/Identifier/qual/1.0/', 'xmpidq'],
	['http://ns.adobe.com/xap/1.0/sType/ResourceEvent#', 'stEvt'],
	['http://ns.adobe.com/xap/1.0/sType/ResourceRef#', 'stRef'],
	['http://ns.adobe.com/xap/1.0/sType/Dimensions#', 'stDim'],
	['http://ns.adobe.com/xmp/sType/Area#', 'stArea'],
	['http://ns.adobe.com/photoshop/1.0/', 'photoshop'],
	['http://ns.adobe.com/tiff/1.0/', 'tiff'],
	['http://ns.adobe.com/exif/1.0/', 'exif'],
	['http://cipa.jp/exif/1.0/', 'exifEX'],
	['http://ns.adobe.com/exif/1.0/aux/', 'aux'],
	['http://ns.adobe.com/camera-raw-settings/1.0/', 'crs'],
	[NAMESPACE.lr, 'lr'],
	['http://iptc.org/std/Iptc4xmpCore/1.0/xmlns/', 'Iptc4xmpCore'],
	['http://iptc.org/std/Iptc4xmpExt/2008-02-29/', 'Iptc4xmpExt'],
	['http://ns.useplus.org/ldf/xmp/1.0/', 'plus'],
	['http://www.metadataworkinggroup.com/schemas/regions/', 'mwg-rs'],
	['http://www.metadataworkinggroup.com/schemas/keywords/', 'mwg-kw'],
	['http://www.metadataworkinggroup.com/schemas/collections/', 'mwg-coll'],
	[NAMESPACE.darktable, 'darktable'],
	[NAMESPACE.digiKam, 'digiKam'],
	['http://ns.microsoft.com/photo/1.0/', 'MicrosoftPhoto'],
	['https://polandy.github.io/framehive/ns/1.0/', 'framehive'],
	[NAMESPACE.honeycomb, 'honeycomb'],
])

/** The kind of an XMP array. */
export type ArrayKind = 'Bag' | 'Seq' | 'Alt'

/** The value of a property, struct field, array item or qualifier (ISO 16684-1). */
export type XmpValue
	= | { readonly kind: 'text', readonly text: string }
		| { readonly kind: 'uri', readonly uri: string }
		| { readonly kind: 'struct', readonly fields: XmpFields }
		| { readonly kind: 'array', readonly array: ArrayKind, readonly items: readonly XmpNode[] }

/** A value with its qualifiers; `xml:lang` is a qualifier too. */
export interface XmpNode {
	readonly value: XmpValue
	readonly qualifiers: XmpFields
}

/** Properties, struct fields or qualifiers by `xmpKey`, in no order. */
export type XmpFields = ReadonlyMap<string, XmpNode>

/** A sidecar's properties and the prefix the file gave each namespace. */
export interface XmpPacket {
	readonly properties: XmpFields
	readonly prefixes: ReadonlyMap<string, string>
}

/** A moment and the local UTC offset to write it in, injected instead of a clock. */
export interface XmpTime {
	readonly epochMs: number
	readonly offsetMinutes: number
}

/** Why a sidecar was refused. */
export type XmpRefusal = 'not-utf-8' | 'malformed' | 'doctype' | 'conflict' | 'not-xmp'

/** A line and column in a sidecar, both from 1. */
export interface XmlPosition {
	readonly line: number
	readonly column: number
}

/** A sidecar that cannot be read, with the reason and, where known, the position. */
export class XmpError extends Error {
	/** Refuses a sidecar for a reason. */
	constructor(readonly reason: XmpRefusal, message: string, readonly position: XmlPosition | null = null) {
		super(message)
		this.name = 'XmpError'
	}
}

/** A packet without properties. */
export const EMPTY_PACKET: XmpPacket = { properties: new Map(), prefixes: new Map() }

/** The key of a name: URIs and local names hold no space. */
export function xmpKey(namespace: string, local: string): string {
	return `${namespace} ${local}`
}

/** The namespace and local name of a key. */
export function xmpName(key: string): { readonly namespace: string, readonly local: string } {
	const space = key.lastIndexOf(' ')
	return { namespace: key.slice(0, space), local: key.slice(space + 1) }
}

/** A simple value. */
export function textNode(text: string, qualifiers: XmpFields = EMPTY_PACKET.properties): XmpNode {
	return { value: { kind: 'text', text }, qualifiers }
}
