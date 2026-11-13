// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Tag } from '../tag.ts'
import type { XmpNode, XmpPacket } from './model.ts'

import { HIERARCHY_SEPARATOR, leafOf, TAG_SEPARATOR } from '../tag.ts'
import { EMPTY_PACKET, NAMESPACE, textNode, xmpKey } from './model.ts'

/** Tags added and removed in one step. */
export interface TagChange {
	readonly added: readonly Tag[]
	readonly removed: readonly Tag[]
}

/** The tags every sidecar of a picture gets, and the removed tags whose leaves leave `dc:subject`. */
export interface TagWrite {
	readonly tags: readonly Tag[]
	readonly removed: readonly Tag[]
}

/** The tag fields honeycomb reads and writes (`docs/07-tags.md` Reading). */
const TAG_FIELD = {
	tagsList: xmpKey(NAMESPACE.digiKam, 'TagsList'),
	hierarchicalSubject: xmpKey(NAMESPACE.lr, 'hierarchicalSubject'),
	subject: xmpKey(NAMESPACE.dc, 'subject'),
} as const

/** Stands for a separator a field cannot hold inside a name, as digiKam reads it. */
const ESCAPED_SEPARATOR = '\\'

/** How each field splits an item into names; `dc:subject` holds one name per item. */
const READ_ORDER: readonly { readonly key: string, readonly separator: string | null }[] = [
	{ key: TAG_FIELD.tagsList, separator: TAG_SEPARATOR },
	{ key: TAG_FIELD.hierarchicalSubject, separator: HIERARCHY_SEPARATOR },
	{ key: TAG_FIELD.subject, separator: null },
]

/** The tags of a sidecar's first tag field that holds one, sorted (XMP-004). */
export function sidecarTags(packet: XmpPacket): readonly Tag[] {
	for (const { key, separator } of READ_ORDER) {
		const tags = itemTexts(packet.properties.get(key)).map((item) => tagOfItem(item, separator)).filter((tag) => tag !== null)
		if (tags.length > 0) {
			return sortedUnique(tags)
		}
	}
	return []
}

/** The union of the tags of every source of a picture, sorted (D2). */
export function pictureTags(sources: readonly XmpPacket[]): readonly Tag[] {
	return sortedUnique(sources.flatMap(sidecarTags))
}

/** The change applied to the sources as they are now, to be written to each sidecar. */
export function tagWrite(sources: readonly XmpPacket[], change: TagChange): TagWrite {
	const removed = new Set(change.removed)
	const kept = pictureTags(sources).filter((tag) => !removed.has(tag))
	return { tags: sortedUnique([...kept, ...change.added]), removed: change.removed }
}

/** Sets the three tag fields to the write and keeps every other property (`docs/07-tags.md` Writing). */
export function mergeTags(packet: XmpPacket, write: TagWrite): XmpPacket {
	const properties = new Map(packet.properties)
	const set = (key: string, node: XmpNode | null): void => {
		if (node === null) {
			properties.delete(key)
		} else {
			properties.set(key, node)
		}
	}
	const paths = write.tags.length === 0 ? null : write.tags
	set(TAG_FIELD.tagsList, paths && arrayOf('Seq', paths))
	set(TAG_FIELD.hierarchicalSubject, paths && arrayOf('Bag', paths.map((tag) => tag.replaceAll(TAG_SEPARATOR, HIERARCHY_SEPARATOR))))
	set(TAG_FIELD.subject, subjectOf(packet.properties.get(TAG_FIELD.subject), write))
	return { properties, prefixes: packet.prefixes }
}

/** `dc:subject`: the keywords there that are not only the leaf of a removed tag, then the missing leaves (D9). */
function subjectOf(existing: XmpNode | undefined, write: TagWrite): XmpNode | null {
	const leaves = new Set(write.tags.map(leafOf))
	const removedLeaves = new Set(write.removed.map(leafOf).filter((leaf) => !leaves.has(leaf)))
	const kept = itemNodes(existing).filter((item) => item.value.kind !== 'text' || !removedLeaves.has(item.value.text.trim()))
	const present = new Set(kept.map((item) => (item.value.kind === 'text' ? item.value.text.trim() : null)))
	const added = [...leaves].filter((leaf) => !present.has(leaf)).map((leaf) => textNode(leaf))
	const items = [...kept, ...added]
	return items.length === 0 ? null : { value: { kind: 'array', array: 'Bag', items }, qualifiers: existing?.qualifiers ?? EMPTY_PACKET.properties }
}

/** The items of an array field, or the field itself when it is one text. */
function itemNodes(node: XmpNode | undefined): readonly XmpNode[] {
	if (node === undefined) {
		return []
	}
	return node.value.kind === 'array' ? node.value.items : [node]
}

/** The texts of a field's items; an item that is not text is skipped. */
function itemTexts(node: XmpNode | undefined): string[] {
	return itemNodes(node).flatMap((item) => (item.value.kind === 'text' ? [item.value.text] : []))
}

/** The tag an item names: split at the field's separator, other separators read as `\`, empty names dropped. */
function tagOfItem(item: string, separator: string | null): Tag | null {
	const names = separator === null ? [item] : item.split(separator)
	const tag = names
		.map((name) => name.replaceAll(TAG_SEPARATOR, ESCAPED_SEPARATOR).replaceAll(HIERARCHY_SEPARATOR, ESCAPED_SEPARATOR).trim())
		.filter((name) => name !== '')
		.join(TAG_SEPARATOR)
	return tag === '' ? null : tag
}

/** An array of simple values. */
function arrayOf(array: 'Seq' | 'Bag', texts: readonly string[]): XmpNode {
	return { value: { kind: 'array', array, items: texts.map((text) => textNode(text)) }, qualifiers: EMPTY_PACKET.properties }
}

/** Each tag once, in code-unit order so the written list is stable. */
function sortedUnique(tags: readonly Tag[]): readonly Tag[] {
	return [...new Set(tags)].sort()
}
