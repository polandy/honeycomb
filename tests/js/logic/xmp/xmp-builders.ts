// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { XmpFields, XmpNode, XmpPacket, XmpTime } from '../../../../src/logic/xmp/model.ts'

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { NAMESPACE, xmpKey } from '../../../../src/logic/xmp/model.ts'

/** 2026-11-08T14:03:12+01:00, the time of the canonical fixture. */
export const CANONICAL_TIME: XmpTime = { epochMs: Date.UTC(2026, 10, 8, 13, 3, 12), offsetMinutes: 60 }

type Prefix = keyof typeof NAMESPACE

/** The bytes of a fixture under `tests/fixtures/xmp/`. */
export function fixtureBytes(name: string): Uint8Array {
	return new Uint8Array(readFileSync(resolve(import.meta.dirname, '../../../fixtures/xmp', name)))
}

/** The text of a fixture under `tests/fixtures/xmp/`. */
export function fixtureText(name: string): string {
	return new TextDecoder().decode(fixtureBytes(name))
}

/** The key of a property written as `prefix:Name` with a prefix of `NAMESPACE`. */
export function key(qualified: string): string {
	const [prefix, local] = qualified.split(':') as [Prefix, string]
	return xmpKey(NAMESPACE[prefix], local)
}

/** A simple value with optional qualifiers. */
export function text(value: string, qualifiers: XmpFields = new Map()): XmpNode {
	return { value: { kind: 'text', text: value }, qualifiers }
}

/** An ordered array of simple values. */
export function seq(items: readonly string[]): XmpNode {
	return { value: { kind: 'array', array: 'Seq', items: items.map((item) => text(item)) }, qualifiers: new Map() }
}

/** A packet with the given properties, each written as `prefix:Name`. */
export function packetOf(properties: Readonly<Record<string, XmpNode | string>>): XmpPacket {
	const entries = Object.entries(properties).map(([name, node]): [string, XmpNode] => [key(name), typeof node === 'string' ? text(node) : node])
	return { properties: new Map(entries), prefixes: new Map() }
}

/** The text of a simple property written as `prefix:Name`, or undefined when absent. */
export function textOf(packet: XmpPacket, qualified: string): string | undefined {
	const node = packet.properties.get(key(qualified))
	return node?.value.kind === 'text' ? node.value.text : undefined
}

/** The item texts of an array property written as `prefix:Name`, or undefined when absent. */
export function itemsOf(packet: XmpPacket, qualified: string): string[] | undefined {
	const node = packet.properties.get(key(qualified))
	return node?.value.kind === 'array' ? node.value.items.map((item) => (item.value.kind === 'text' ? item.value.text : '')) : undefined
}
