// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../decision.ts'
import type { XmpNode, XmpPacket, XmpTime } from './model.ts'

import { colourLabelIndex, DARKTABLE_LABELS, LABEL_TEXTS, PICK_LABEL, PROPERTY, simpleText, XMP_FALSE, XMP_TRUE } from './fields.ts'
import { EMPTY_PACKET, textNode } from './model.ts'
import { readXmp } from './parse.ts'
import { serializeXmp } from './serialize.ts'

/** What a merge needs besides the decision: whether the picture is a pair and whether its colour label changed. */
export interface MergeContext {
	readonly isPair: boolean
	readonly colourLabelChanged: boolean
}

const REJECTED_RATING = '-1'
const PICK = { picked: '1', rejected: '-1' } as const

/** Sets honeycomb's properties to the decision and keeps everything else (`docs/06-xmp-interop.md` Writing). */
export function mergeDecision(packet: XmpPacket, decision: Decision, context: MergeContext): XmpPacket {
	const properties = new Map(packet.properties)
	const set = (key: string, text: string | undefined): void => {
		if (text === undefined) {
			properties.delete(key)
		} else {
			properties.set(key, textNode(text, properties.get(key)?.qualifiers))
		}
	}
	const { flag } = decision
	set(PROPERTY.rating, flag === 'rejected' ? REJECTED_RATING : String(decision.rating))
	set(PROPERTY.pickLabel, flag === 'unflagged' ? pendingPickLabel(packet) : String(flag === 'picked' ? PICK_LABEL.accepted : PICK_LABEL.rejected))
	set(PROPERTY.pick, flag === 'unflagged' ? undefined : PICK[flag])
	set(PROPERTY.good, flag === 'unflagged' ? undefined : (flag === 'picked' ? XMP_TRUE : XMP_FALSE))
	const index = colourLabelIndex(decision.colourLabel)
	set(PROPERTY.colorLabel, String(index))
	const isDarktable = packet.properties.has(PROPERTY.darktableVersion)
	if (!isDarktable || packet.properties.has(PROPERTY.label)) {
		set(PROPERTY.label, index === 0 ? undefined : LABEL_TEXTS[index])
	}
	if (isDarktable && context.colourLabelChanged) {
		const darktableIndex = decision.colourLabel === null ? -1 : DARKTABLE_LABELS.indexOf(decision.colourLabel)
		if (darktableIndex < 0) {
			properties.delete(PROPERTY.colorlabels)
		} else {
			properties.set(PROPERTY.colorlabels, darktableList(darktableIndex))
		}
	}
	if (context.isPair) {
		set(PROPERTY.keepRaw, decision.keepRaw ? XMP_TRUE : undefined)
	}
	return { properties, prefixes: packet.prefixes }
}

/** Merges the decision into a sidecar's bytes, or a new one, and writes it at the time; a refused sidecar throws its `XmpError`. */
export function writeSidecar(existing: Uint8Array | null, decision: Decision, context: MergeContext, time: XmpTime): Uint8Array {
	const packet = existing === null ? EMPTY_PACKET : readXmp(existing)
	return serializeXmp(mergeDecision(packet, decision, context), time)
}

/** digiKam's pending pick label when the sidecar has it, so an unflagged picture keeps it. */
function pendingPickLabel(packet: XmpPacket): string | undefined {
	const pending = String(PICK_LABEL.pending)
	return simpleText(packet, PROPERTY.pickLabel)?.trim() === pending ? pending : undefined
}

/** darktable's colour label list holding one index. */
function darktableList(index: number): XmpNode {
	return { value: { kind: 'array', array: 'Seq', items: [textNode(String(index))] }, qualifiers: EMPTY_PACKET.properties }
}
