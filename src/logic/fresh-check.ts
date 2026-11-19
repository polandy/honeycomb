// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { EmbeddedXmpAnswer } from './embedded-xmp.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarLookupAnswer } from './sidecar-sync.ts'
import type { Tag } from './tag.ts'
import type { SidecarBytes } from './xmp/decision.ts'

import { sameDecision, UNDECIDED } from './decision.ts'
import { embeddedSidecarPath, embeddedXmpSource } from './embedded-xmp.ts'
import { splitFolder } from './file-name.ts'
import { memberIds, pictureMembers } from './pairing.ts'
import { pictureFlag, readDecision } from './picture-flag.ts'
import { embeddedBytes, isPair, sidecarBytes } from './sidecar-sync.ts'
import { pictureSidecarDecision, sidecarDecision } from './xmp/decision.ts'
import { readXmp } from './xmp/parse.ts'
import { pictureTags } from './xmp/tags.ts'
import { sidecarTargets } from './xmp/targets.ts'

/** The flow that deletes by decision: Delete rejected, or Remove RAWs (ADR 0032 Deleting by decision). */
export type DecisionFlow = 'rejects' | 'raws'

/** Why a picture is skipped instead of deleted (DELETE-002.16). */
export type SkipReason = 'changed' | 'unread' | 'refused' | 'notRejected' | 'notRemovable' | 'jpegSidecar'

/** A picture the fresh check kept out of the delete, and why. */
export interface SkippedPicture {
	readonly picture: Picture<ListingEntry>
	readonly reason: SkipReason
}

/** A picture that passes, with its state and the JPEG sidecar to write first, if any. */
export interface FreshPass {
	readonly decision: Decision
	readonly tags: readonly Tag[]
	readonly jpegSidecar: string | null
}

type Answers = ReadonlyMap<number, SidecarLookupAnswer>
type Embedded = ReadonlyMap<number, EmbeddedXmpAnswer>
type Verdict = FreshPass | { readonly reason: Exclude<SkipReason, 'changed' | 'jpegSidecar'> }

const ROOT = '/'

/** The folders of every file of the pictures, each once in first-seen order, the root as `/`. */
export function freshFolders(pictures: readonly Picture<ListingEntry>[]): string[] {
	const paths = pictures.flatMap((picture) => [...pictureMembers(picture), ...picture.sidecars]).map((entry) => splitFolder(entry.path).parent)
	return [...new Set(paths.map((folder) => (folder === '' ? ROOT : folder)))]
}

/** Each picture with its fresh listing, matched by its members; one whose members changed is skipped. */
export function matchFresh(pictures: readonly Picture<ListingEntry>[], fresh: readonly Picture<ListingEntry>[]) {
	const byMembers = new Map(fresh.map((picture) => [memberIds(picture).join(), picture]))
	const matched: { readonly picture: Picture<ListingEntry>, readonly fresh: Picture<ListingEntry> }[] = []
	const skipped: SkippedPicture[] = []
	for (const picture of pictures) {
		const found = byMembers.get(memberIds(picture).join())
		if (found === undefined) {
			skipped.push({ picture, reason: 'changed' })
		} else {
			matched.push({ picture, fresh: found })
		}
	}
	return { matched, skipped }
}

/** The file ids to read: every sidecar but darktable duplicates, and the JPEGs whose embedded XMP counts. */
export function freshLookups(pictures: readonly Picture<ListingEntry>[]) {
	return {
		sidecars: pictures.flatMap((picture) => sidecarTargets(picture).existing.map((entry) => entry.fileId)),
		embedded: pictures.flatMap((picture) => embeddedXmpSource(picture)?.fileId ?? []),
	}
}

/** Whether the fresh picture may go in the flow: every source read and valid, and its flag, from its rows or else its sidecars, the one the flow needs. */
export function freshVerdict(flow: DecisionFlow, picture: Picture<ListingEntry>, answers: Answers, embedded: Embedded): Verdict {
	const sources = sourcesOf(picture, answers, embedded)
	if (sources === null) {
		return { reason: 'unread' }
	}
	const pair = isPair(picture)
	const { winner, refused } = pictureSidecarDecision(sources, pair)
	if (refused.length > 0) {
		return { reason: 'refused' }
	}
	const decision = readDecision(pictureFlag(picture), winner?.decision ?? UNDECIDED)
	if (!letsGo(flow, decision)) {
		return { reason: flow === 'rejects' ? 'notRejected' : 'notRemovable' }
	}
	const tags = pictureTags(sources.map((source) => readXmp(source.bytes)))
	return { decision, tags, jpegSidecar: flow === 'raws' ? jpegSidecarOf(picture, sources) : null }
}

/** Whether a picture the fresh check could not read goes as the cull knows it: not a pair whose RAW sidecar's values would have to be copied to a new JPEG sidecar. */
export function goesUnchecked(flow: DecisionFlow, picture: Picture<ListingEntry>): boolean {
	const { created, existing } = sidecarTargets(picture)
	return flow === 'rejects' || picture.rendered === null || existing.length === 0 || !created.includes(embeddedSidecarPath(picture.rendered))
}

/** Whether the picture's decision lets it go in the flow. */
function letsGo(flow: DecisionFlow, decision: Decision): boolean {
	return flow === 'rejects' ? decision.flag === 'rejected' : decision.flag !== 'rejected' && !decision.keepRaw
}

/** The picture's sources as read, or `null` when one was not answered or could not be read. */
function sourcesOf(picture: Picture<ListingEntry>, answers: Answers, embedded: Embedded): SidecarBytes[] | null {
	const sources: SidecarBytes[] = []
	for (const sidecar of sidecarTargets(picture).existing) {
		const answer = answers.get(sidecar.fileId)
		if (answer?.result !== 'read') {
			return null
		}
		sources.push(sidecarBytes(picture, sidecar.path, answer))
	}
	const jpeg = embeddedXmpSource(picture)
	if (jpeg !== null) {
		const answer = embedded.get(jpeg.fileId)
		if (answer === undefined || (answer.result !== 'read' && answer.result !== 'none')) {
			return null
		}
		if (answer.result === 'read') {
			sources.push(embeddedBytes(jpeg, answer.bytes))
		}
	}
	return sources
}

/** The JPEG sidecar to create before the RAW goes: while the JPEG has none of its own or shared and the RAW's own sidecars hold values. */
function jpegSidecarOf(picture: Picture<ListingEntry>, sources: readonly SidecarBytes[]): string | null {
	if (picture.rendered === null || !sidecarTargets(picture).created.includes(embeddedSidecarPath(picture.rendered))) {
		return null
	}
	const ofRaw = sources.filter((source) => source.ofRaw).map((source) => readXmp(source.bytes))
	const holdsValues = ofRaw.some((packet) => !sameDecision(sidecarDecision(packet, true), UNDECIDED)) || pictureTags(ofRaw).length > 0
	return holdsValues ? embeddedSidecarPath(picture.rendered) : null
}
