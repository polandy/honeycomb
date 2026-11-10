// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { KnownSidecar, PlannedSave, SidecarFailure, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from './logic/sidecar-sync.ts'
import type { XmpTime } from './logic/xmp/model.ts'

import { logger } from './logger.ts'
import { applySaves, planSaves, takeOverDecisions, takeOverLookups, writeLookups } from './logic/sidecar-sync.ts'

/** The sidecar endpoints (ADR 0017). */
export interface SidecarApi {
	lookupSidecars(fileIds: readonly number[]): Promise<SidecarLookupAnswer[]>
	saveSidecars(items: readonly SidecarSaveItem[]): Promise<SidecarSaveAnswer[]>
}

type Pictures = readonly Picture<ListingEntry>[]
type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>

/** Takes the decision over from the sidecars and writes decisions to them, one write after another (XMP-003). */
export function useSidecarSync(api: SidecarApi, now: () => XmpTime, onFailed: (failed: SidecarFailure[]) => void) {
	let known = new Map<string, KnownSidecar>()
	let queue: Promise<unknown> = Promise.resolve()

	/** The decision of the sidecars of each picture without a stored decision for any member. */
	async function takeOver(pictures: Pictures, stored: ReadonlySet<number>) {
		const lookups = takeOverLookups(pictures, stored)
		const fileIds = lookups.flatMap(({ sidecars }) => sidecars.map((sidecar) => sidecar.fileId))
		if (fileIds.length === 0) {
			return []
		}
		let answers: SidecarLookupAnswer[]
		try {
			answers = await api.lookupSidecars(fileIds)
		} catch (error) {
			logger.warn('Could not look up the sidecars; nothing is taken over', { error })
			return []
		}
		const { decided, warnings } = takeOverDecisions(lookups, new Map(fileIds.map((fileId, index) => [fileId, answers[index]!])))
		warnings.forEach((warning) => logger.warn('Could not take over the decision of a sidecar', warning))
		return decided
	}

	/** Writes each picture's decision, read when the write starts, to its sidecars; `paths` limits a picture to those sidecars. */
	function write(pictures: Pictures, decisionOf: (picture: Picture<ListingEntry>) => Decision, paths?: Paths) {
		const written = queue.then(() => writeNow(pictures, decisionOf, paths))
		queue = written
		return written
	}

	/** One write: a round, and one more for the sidecars that changed meanwhile. */
	async function writeNow(pictures: Pictures, decisionOf: (picture: Picture<ListingEntry>) => Decision, paths?: Paths) {
		const first = await round(pictures, decisionOf, paths)
		const again = new Map<Picture<ListingEntry>, Set<string>>()
		first.changed.forEach(({ picture, path }) => again.set(picture, (again.get(picture) ?? new Set()).add(path)))
		const second = await round([...again.keys()], decisionOf, again)
		const failed = [...first.failed, ...second.failed, ...second.changed.map(({ path, picture }) => ({ path, picture, reason: 'changed' as const }))]
		if (failed.length > 0) {
			onFailed(failed)
		}
		return { written: pictures.filter((picture) => !failed.some((failure) => failure.picture === picture)).length, failed }
	}

	/** Reads the sidecars honeycomb holds no bytes of, merges the decisions and saves them in one request each. */
	async function round(pictures: Pictures, decisionOf: (picture: Picture<ListingEntry>) => Decision, paths?: Paths) {
		const answers = await lookUp(pictures.flatMap((picture) => writeLookups(picture, known, paths?.get(picture))))
		const time = now()
		const planned = pictures.map((picture) => planSaves(picture, decisionOf(picture), known, answers, time, paths?.get(picture)))
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

	return { takeOver, write }
}
