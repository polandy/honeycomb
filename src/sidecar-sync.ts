// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { KnownSidecar, PlannedSave, SidecarEdit, SidecarFailure, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from './logic/sidecar-sync.ts'
import type { TagChange } from './logic/tag.ts'
import type { XmpTime } from './logic/xmp/model.ts'

import { logger } from './logger.ts'
import { applySaves, planSaves, takeOverDecisions, takeOverLookups, writeLookups } from './logic/sidecar-sync.ts'
import { takeOverTags } from './logic/sidecar-tags.ts'

/** The sidecar endpoints (ADR 0017). */
export interface SidecarApi {
	lookupSidecars(fileIds: readonly number[]): Promise<SidecarLookupAnswer[]>
	saveSidecars(items: readonly SidecarSaveItem[]): Promise<SidecarSaveAnswer[]>
}

type Pictures = readonly Picture<ListingEntry>[]
type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>
type EditOf = (picture: Picture<ListingEntry>) => SidecarEdit

/** Takes decisions and tags over from the sidecars and writes them to the sidecars, one write after another (XMP-003, TAGS-002). */
export function useSidecarSync(api: SidecarApi, now: () => XmpTime, onFailed: (failed: SidecarFailure[]) => void) {
	let known = new Map<string, KnownSidecar>()
	let queue: Promise<unknown> = Promise.resolve()

	/** The decision of the sidecars of each picture without a stored decision for any member, and the tags of those without stored tags; none while the stored tags are unknown. */
	async function takeOver(pictures: Pictures, stored: ReadonlySet<number>, storedTags: ReadonlySet<number> | null) {
		const lookups = takeOverLookups(pictures, stored)
		const fileIds = lookups.flatMap(({ sidecars }) => sidecars.map((sidecar) => sidecar.fileId))
		if (fileIds.length === 0) {
			return { decided: [], tagged: [] }
		}
		let answers: Map<number, SidecarLookupAnswer>
		try {
			const answered = await api.lookupSidecars(fileIds)
			answers = new Map(fileIds.map((fileId, index) => [fileId, answered[index]!]))
		} catch (error) {
			logger.warn('Could not look up the sidecars; nothing is taken over', { error })
			return { decided: [], tagged: [] }
		}
		const { decided, warnings } = takeOverDecisions(lookups, answers)
		warnings.forEach((warning) => logger.warn('Could not take over the decision of a sidecar', warning))
		const { tagged, leftOut } = storedTags === null ? { tagged: [], leftOut: [] } : takeOverTags(lookups, answers, storedTags)
		leftOut.forEach((tag) => logger.warn('A sidecar tag cannot be stored; it is left out', { tag }))
		return { decided, tagged }
	}

	/** Writes each picture's decision, read when the write starts, to its sidecars; `paths` limits a picture to those sidecars. */
	function write(pictures: Pictures, decisionOf: (picture: Picture<ListingEntry>) => Decision, paths?: Paths) {
		return queued(pictures, (picture) => ({ decision: decisionOf(picture) }), paths)
	}

	/** Writes the tag change to each picture's sidecars, applied to their tags when the write starts; `paths` limits a picture to those sidecars. */
	function writeTags(pictures: Pictures, change: TagChange, paths?: Paths) {
		return queued(pictures, () => ({ tags: change }), paths)
	}

	/** Writes the failed sidecars once more: a decision as it is now, a tag change as it was. */
	function retry(failed: readonly SidecarFailure[], decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const byChange = new Map<TagChange | null, Map<Picture<ListingEntry>, Set<string>>>()
		for (const { picture, path, tags } of failed) {
			const paths = byChange.get(tags ?? null) ?? new Map<Picture<ListingEntry>, Set<string>>()
			byChange.set(tags ?? null, paths.set(picture, (paths.get(picture) ?? new Set()).add(path)))
		}
		return Promise.all([...byChange].map(([change, paths]) => (change === null ? write([...paths.keys()], decisionOf, paths) : writeTags([...paths.keys()], change, paths))))
	}

	/** Runs the write after those before it. */
	function queued(pictures: Pictures, editOf: EditOf, paths?: Paths) {
		const written = queue.then(() => writeNow(pictures, editOf, paths))
		queue = written.catch(() => undefined)
		return written
	}

	/** One write: a round, and one more for the sidecars that changed meanwhile; a tag change's failures carry it for a retry. */
	async function writeNow(pictures: Pictures, editOf: EditOf, paths?: Paths) {
		const first = await round(pictures, editOf, paths)
		const again = new Map<Picture<ListingEntry>, Set<string>>()
		first.changed.forEach(({ picture, path }) => again.set(picture, (again.get(picture) ?? new Set()).add(path)))
		const second = await round([...again.keys()], editOf, again)
		const failed = [...first.failed, ...second.failed, ...second.changed.map(({ path, picture }) => ({ path, picture, reason: 'changed' as const }))].map((failure): SidecarFailure => {
			const edit = editOf(failure.picture)
			return 'tags' in edit ? { ...failure, tags: edit.tags } : failure
		})
		if (failed.length > 0) {
			onFailed(failed)
		}
		return { written: pictures.filter((picture) => !failed.some((failure) => failure.picture === picture)).length, failed }
	}

	/** Reads the sidecars honeycomb holds no bytes of, merges the edits and saves them in one request each. */
	async function round(pictures: Pictures, editOf: EditOf, paths?: Paths) {
		const answers = await lookUp(pictures.flatMap((picture) => writeLookups(picture, known, paths?.get(picture))))
		const time = now()
		const planned = pictures.map((picture) => planSaves(picture, editOf(picture), known, answers, time, paths?.get(picture)))
		const saved = await save(planned.flatMap(({ saves }) => saves))
		return { failed: [...planned.flatMap(({ failed }) => failed), ...saved.failed], changed: saved.changed }
	}

	/** The lookup answers by file id; none when the request failed. */
	async function lookUp(fileIds: number[]): Promise<Map<number, SidecarLookupAnswer>> {
		if (fileIds.length === 0) {
			return new Map()
		}
		try {
			const answers = await api.lookupSidecars(fileIds)
			return new Map(fileIds.map((fileId, index) => [fileId, answers[index]!]))
		} catch (error) {
			logger.error('Could not look up the sidecars to write', { error })
			return new Map()
		}
	}

	/** Saves the sidecars and remembers what was saved. */
	async function save(saves: PlannedSave[]) {
		if (saves.length === 0) {
			return { failed: [], changed: [] }
		}
		let answers: SidecarSaveAnswer[] | null = null
		try {
			answers = await api.saveSidecars(saves.map(({ item }) => item))
		} catch (error) {
			logger.error('Could not save the sidecars', { error })
		}
		const applied = applySaves(saves, answers, known)
		known = applied.known
		return applied
	}

	return { takeOver, write, writeTags, retry }
}
