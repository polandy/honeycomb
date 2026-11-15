// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionField } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { SidecarEdit, SidecarFailure } from './sidecar-sync.ts'
import type { TagChange } from './tag.ts'

import { DECISION_FIELDS, deltaOf } from './decision.ts'
import { combinedChange } from './tag.ts'

type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>
type DecisionOf = (picture: Picture<ListingEntry>) => Decision

/** A write waiting for its pass: its pictures, the decision read when the pass starts with the fields it changed, or the tag change, and the paths a picture is limited to. */
export interface SidecarStep {
	readonly pictures: readonly Picture<ListingEntry>[]
	readonly decisionOf: DecisionOf | null
	readonly fields?: readonly DecisionField[]
	readonly tags: TagChange | null
	readonly paths?: Paths | undefined
}

interface PictureWrite {
	readonly decisionOf: DecisionOf | null
	readonly fields: readonly DecisionField[]
	readonly tags: TagChange | null
	readonly paths: ReadonlySet<string> | null
}

/** The pass that writes the steps together (XMP-003.16): each picture once, with the fields of its steps valued by the latest decision, the tag changes in order and the union of its paths. */
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
		const { decisionOf, fields, tags } = writes.get(picture) ?? { decisionOf: null, fields: [], tags: null }
		if (decisionOf === null) {
			return { tags: tags ?? { added: [], removed: [] } }
		}
		const decision = deltaOf(decisionOf(picture), fields)
		return tags === null ? { decision } : { decision, tags }
	}
	return { pictures: [...writes.keys()], paths, editOf }
}

/** The failure with what its edit wrote, for a retry: the tag change and the decision fields. */
export function failureOf(failure: SidecarFailure, edit: SidecarEdit): SidecarFailure {
	const { decision, tags } = edit
	const withTags = tags === undefined ? failure : { ...failure, tags }
	return decision === undefined ? withTags : { ...withTags, fields: DECISION_FIELDS.filter((field) => field in decision) }
}

/** What a step's write answers: how many of its pictures were written, and the failures of its pictures and paths. */
export function stepResult(step: SidecarStep, failed: readonly SidecarFailure[]) {
	const own = failed.filter(({ picture, path }) => step.pictures.includes(picture) && (step.paths?.get(picture)?.has(path) ?? true))
	return { written: step.pictures.filter((picture) => !own.some((failure) => failure.picture === picture)).length, failed: own }
}

/** The step that writes a failed sidecar once more: its decision fields as they are then, a tag change as it was. */
export function retryStep({ picture, path, tags, fields }: SidecarFailure, decisionOf: DecisionOf): SidecarStep {
	const paths = new Map([[picture, new Set([path])]])
	return fields === undefined ? { pictures: [picture], decisionOf: null, tags: tags ?? null, paths } : { pictures: [picture], decisionOf, fields, tags: tags ?? null, paths }
}

/** The picture's write with the step joined: its decision replaces, its fields add up, its tag change follows, its paths add up and no limit wins. */
function joined(before: PictureWrite | undefined, step: SidecarStep, own: ReadonlySet<string> | undefined): PictureWrite {
	const tags = before?.tags ?? null
	const fields = step.decisionOf === null ? [] : (step.fields ?? DECISION_FIELDS)
	return {
		decisionOf: step.decisionOf ?? before?.decisionOf ?? null,
		fields: DECISION_FIELDS.filter((field) => fields.includes(field) || before?.fields.includes(field) === true),
		tags: step.tags === null ? tags : (tags === null ? step.tags : combinedChange(tags, step.tags)),
		paths: own === undefined || before?.paths === null ? null : new Set([...(before?.paths ?? []), ...own]),
	}
}
