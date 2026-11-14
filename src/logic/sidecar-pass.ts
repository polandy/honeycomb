// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarEdit, SidecarFailure } from './sidecar-sync.ts'
import type { TagChange } from './tag.ts'

import { combinedChange } from './tag.ts'

type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>
type DecisionOf = (picture: Picture<ListingEntry>) => Decision

/** A write waiting for its pass: its pictures, the decision read when the pass starts or the tag change, and the paths a picture is limited to. */
export interface SidecarStep {
	readonly pictures: readonly Picture<ListingEntry>[]
	readonly decisionOf: DecisionOf | null
	readonly tags: TagChange | null
	readonly paths?: Paths | undefined
}

interface PictureWrite {
	readonly decisionOf: DecisionOf | null
	readonly tags: TagChange | null
	readonly paths: ReadonlySet<string> | null
}

/** The pass that writes the steps together (XMP-003.16): each picture once, with the latest decision, the tag changes in order and the union of its paths. */
export function passOf(steps: readonly SidecarStep[]) {
	const writes = new Map<Picture<ListingEntry>, PictureWrite>()
	for (const step of steps) {
		for (const picture of step.pictures) {
			writes.set(picture, joined(writes.get(picture), step, step.paths?.get(picture)))
		}
	}
	const paths = new Map([...writes].flatMap(([picture, write]) => (write.paths === null ? [] : [[picture, write.paths] as const])))
	/** What the pass writes to the picture's sidecars, its decision read now. */
	function editOf(picture: Picture<ListingEntry>): SidecarEdit {
		const { decisionOf, tags } = writes.get(picture) ?? { decisionOf: null, tags: null }
		if (decisionOf === null) {
			return { tags: tags ?? { added: [], removed: [] } }
		}
		return tags === null ? { decision: decisionOf(picture) } : { decision: decisionOf(picture), tags }
	}
	return { pictures: [...writes.keys()], paths, editOf }
}

/** The failure with what its edit wrote, for a retry: the tag change, and whether a decision came along. */
export function failureOf(failure: SidecarFailure, edit: SidecarEdit): SidecarFailure {
	if (edit.tags === undefined) {
		return failure
	}
	return edit.decision === undefined ? { ...failure, tags: edit.tags } : { ...failure, tags: edit.tags, decision: true }
}

/** What a step's write answers: how many of its pictures were written, and the failures of its pictures and paths. */
export function stepResult(step: SidecarStep, failed: readonly SidecarFailure[]) {
	const own = failed.filter(({ picture, path }) => step.pictures.includes(picture) && (step.paths?.get(picture)?.has(path) ?? true))
	return { written: step.pictures.filter((picture) => !own.some((failure) => failure.picture === picture)).length, failed: own }
}

/** The step that writes a failed sidecar once more: a decision as it is then, a tag change as it was. */
export function retryStep({ picture, path, tags, decision }: SidecarFailure, decisionOf: DecisionOf): SidecarStep {
	return { pictures: [picture], decisionOf: tags === undefined || decision === true ? decisionOf : null, tags: tags ?? null, paths: new Map([[picture, new Set([path])]]) }
}

/** The picture's write with the step joined: its decision replaces, its tag change follows, its paths add up and no limit wins. */
function joined(before: PictureWrite | undefined, step: SidecarStep, own: ReadonlySet<string> | undefined): PictureWrite {
	const tags = before?.tags ?? null
	return {
		decisionOf: step.decisionOf ?? before?.decisionOf ?? null,
		tags: step.tags === null ? tags : (tags === null ? step.tags : combinedChange(tags, step.tags)),
		paths: own === undefined || before?.paths === null ? null : new Set([...(before?.paths ?? []), ...own]),
	}
}
