// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ColourLabel, Decision, Flag } from '../decision.ts'
import type { XmpPacket } from './model.ts'

import { COLOUR_LABELS } from '../decision.ts'
import { DARKTABLE_LABELS, integerOf, LABEL_TEXTS, PICK_LABEL, PROPERTY, realOf, simpleText, XMP_TRUE } from './fields.ts'
import { XmpError } from './model.ts'
import { readXmp } from './parse.ts'

/** A sidecar of a picture as read: name, modification time, whether it is the RAW member's, and bytes. */
export interface SidecarBytes {
	readonly name: string
	readonly mtime: number
	readonly ofRaw: boolean
	readonly bytes: Uint8Array
}

/** The decision of a picture's sidecars: the winner, the sidecars that disagree with it and the refused ones. */
export interface PictureSidecarDecision {
	readonly winner: { readonly name: string, readonly decision: Decision } | null
	readonly disagreeing: readonly string[]
	readonly refused: readonly { readonly name: string, readonly error: XmpError }[]
}

const MAX_RATING = 5
const REJECTED_RATING = -1
const MAX_PICK_LABEL = PICK_LABEL.accepted
const PICK = { accepted: 1, rejected: -1 } as const

/** The decision one sidecar states, each value from its first valid source (`docs/06-xmp-interop.md` Reading). */
export function sidecarDecision(packet: XmpPacket, isPair: boolean): Decision {
	return {
		rating: readRating(packet),
		colourLabel: readColourLabel(packet),
		flag: readFlag(packet),
		keepRaw: isPair && simpleText(packet, PROPERTY.keepRaw)?.trim().toLowerCase() === XMP_TRUE.toLowerCase(),
	}
}

/** The newest readable sidecar decides as a whole, a tie goes to the RAW member's; disagreements and refusals are reported. */
export function pictureSidecarDecision(sidecars: readonly SidecarBytes[], isPair: boolean): PictureSidecarDecision {
	const read: { readonly sidecar: SidecarBytes, readonly decision: Decision }[] = []
	const refused: { readonly name: string, readonly error: XmpError }[] = []
	for (const sidecar of sidecars) {
		try {
			read.push({ sidecar, decision: sidecarDecision(readXmp(sidecar.bytes), isPair) })
		} catch (error) {
			if (!(error instanceof XmpError)) {
				throw error
			}
			refused.push({ name: sidecar.name, error })
		}
	}
	const best = read.reduce<typeof read[number] | null>((winner, candidate) => (winner === null || isNewer(candidate.sidecar, winner.sidecar) ? candidate : winner), null)
	if (best === null) {
		return { winner: null, disagreeing: [], refused }
	}
	const disagreeing = read.filter((other) => !sameDecision(other.decision, best.decision)).map((other) => other.sidecar.name)
	return { winner: { name: best.sidecar.name, decision: best.decision }, disagreeing, refused }
}

/** Whether a sidecar wins over another: newer, or as new and the RAW member's. */
function isNewer(candidate: SidecarBytes, winner: SidecarBytes): boolean {
	return candidate.mtime > winner.mtime || (candidate.mtime === winner.mtime && candidate.ofRaw && !winner.ofRaw)
}

/** Whether two decisions are equal. */
function sameDecision(left: Decision, right: Decision): boolean {
	return left.rating === right.rating && left.colourLabel === right.colourLabel && left.flag === right.flag && left.keepRaw === right.keepRaw
}

/** `xmp:Rating` 0–5 rounded down; anything else is 0. */
function readRating(packet: XmpPacket): number {
	const rating = realOf(simpleText(packet, PROPERTY.rating))
	return rating !== null && rating >= 0 && rating <= MAX_RATING ? Math.floor(rating) : 0
}

/** PickLabel, then pick (0 skipped), then good, then rating −1, else unflagged. */
function readFlag(packet: XmpPacket): Flag {
	const pickLabel = integerOf(simpleText(packet, PROPERTY.pickLabel))
	if (pickLabel !== null && pickLabel >= PICK_LABEL.none && pickLabel <= MAX_PICK_LABEL) {
		return pickLabel === PICK_LABEL.accepted ? 'picked' : (pickLabel === PICK_LABEL.rejected ? 'rejected' : 'unflagged')
	}
	const pick = integerOf(simpleText(packet, PROPERTY.pick))
	if (pick === PICK.accepted || pick === PICK.rejected) {
		return pick === PICK.accepted ? 'picked' : 'rejected'
	}
	const good = simpleText(packet, PROPERTY.good)?.trim().toLowerCase()
	if (good === 'true' || good === 'false') {
		return good === 'true' ? 'picked' : 'rejected'
	}
	return realOf(simpleText(packet, PROPERTY.rating)) === REJECTED_RATING ? 'rejected' : 'unflagged'
}

/** ColorLabel, then a known `xmp:Label` text in exact case, then the lowest darktable index, else none. */
function readColourLabel(packet: XmpPacket): ColourLabel | null {
	const index = integerOf(simpleText(packet, PROPERTY.colorLabel))
	if (index !== null && index >= 0 && index <= COLOUR_LABELS.length) {
		return indexedLabel(index)
	}
	const text = simpleText(packet, PROPERTY.label)
	const labelIndex = LABEL_TEXTS.findIndex((known) => known === text)
	if (labelIndex >= 0) {
		return indexedLabel(labelIndex)
	}
	return lowestDarktableLabel(packet)
}

/** The colour label of digiKam's index, 0 being none. */
function indexedLabel(index: number): ColourLabel | null {
	return COLOUR_LABELS[index - 1] ?? null
}

/** The colour label of the lowest valid index in `darktable:colorlabels`, or none. */
function lowestDarktableLabel(packet: XmpPacket): ColourLabel | null {
	const node = packet.properties.get(PROPERTY.colorlabels)
	if (node?.value.kind !== 'array') {
		return null
	}
	const indexes = node.value.items
		.map((item) => integerOf(item.value.kind === 'text' ? item.value.text : undefined))
		.filter((index): index is number => index !== null && index >= 0 && index < DARKTABLE_LABELS.length)
	return indexes.length === 0 ? null : DARKTABLE_LABELS[Math.min(...indexes)] ?? null
}
