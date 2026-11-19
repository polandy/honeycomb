// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionField } from './logic/decision.ts'
import type { EmbeddedXmpAnswer } from './logic/embedded-xmp.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SidecarStep } from './logic/sidecar-pass.ts'
import type { KnownSidecar, PlannedSave, SavedSidecar, SidecarEdit, SidecarFailure, SidecarLookupAnswer, SidecarSaveAnswer, SidecarSaveItem } from './logic/sidecar-sync.ts'
import type { Tag, TagChange } from './logic/tag.ts'
import type { XmpCacheRow, XmpCacheSource } from './logic/xmp-cache.ts'
import type { XmpTime } from './logic/xmp/model.ts'

import { shallowRef } from 'vue'
import { logger } from './logger.ts'
import { DECISION_FIELDS, sameDecision, UNDECIDED } from './logic/decision.ts'
import { embeddedXmpSource } from './logic/embedded-xmp.ts'
import { NO_OWN_SAVES, recordSaves, withOwnSaves } from './logic/own-saves.ts'
import { failureOf, passOf, stepResult } from './logic/sidecar-pass.ts'
import { applySaves, planSaves, savedSidecars, writeLookups } from './logic/sidecar-sync.ts'
import { embeddedRow, pictureState, sidecarRow, staleSources, xmpCacheSources } from './logic/xmp-cache.ts'

/** The sidecar endpoints (ADR 0017), the embedded XMP endpoint (ADR 0023) and the XMP cache (ADR 0032). */
export interface SidecarApi {
	lookupXmpCache(fileIds: readonly number[]): Promise<XmpCacheRow[]>
	saveXmpCache(rows: readonly XmpCacheRow[]): Promise<void>
	lookupSidecars(fileIds: readonly number[], sizes?: ReadonlyMap<number, number>): Promise<SidecarLookupAnswer[]>
	lookupEmbeddedXmp(fileIds: readonly number[]): Promise<EmbeddedXmpAnswer[]>
	saveSidecars(items: readonly SidecarSaveItem[]): Promise<SidecarSaveAnswer[]>
}

type Pictures = readonly Picture<ListingEntry>[]
type Paths = ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>
type EditOf = (picture: Picture<ListingEntry>) => SidecarEdit
type Written = { written: number, failed: SidecarFailure[] }

/** A step waiting for its pass, and how to answer its write. */
interface Waiting {
	readonly step: SidecarStep
	readonly resolve: (written: Written) => void
	readonly reject: (error: unknown) => void
}

/** Reads decisions and tags from the sidecars through the XMP cache and writes them to the sidecars, one pass after another, creating missing ones (XMP-003, TAGS-002). */
export function useSidecarSync(api: SidecarApi, now: () => XmpTime, onFailed: (failed: SidecarFailure[]) => void, onSaved: (saved: SavedSidecar[]) => void = () => {}) {
	const known = shallowRef(new Map<string, KnownSidecar>())
	const knownRows = shallowRef<ReadonlyMap<number, XmpCacheRow>>(new Map())
	let own = NO_OWN_SAVES
	let waiting: Waiting[] = []
	let passing = false

	/** The decision and tags of each picture from the XMP cache, reading and storing the sources without a valid row (XMP-006.7). */
	async function read(pictures: Pictures) {
		const sources = xmpCacheSources(pictures)
		if (sources.length === 0) {
			return { decided: [], tagged: [] }
		}
		const rows = await cachedRows(sources.map(({ entry }) => entry.fileId))
		const stale = staleSources(sources, rows)
		const fresh = await readSources(stale, pictures)
		fresh.forEach((row) => rows.set(row.fileId, row))
		const staleIds = new Set(stale.map(({ entry }) => entry.fileId))
		rememberRows([...[...rows.values()].filter(({ fileId }) => !staleIds.has(fileId)), ...fresh])
		if (fresh.length > 0) {
			await storeRows(fresh)
		}
		const decided: { picture: Picture<ListingEntry>, decision: Decision }[] = []
		const tagged: { picture: Picture<ListingEntry>, tags: Tag[] }[] = []
		for (const picture of pictures) {
			const { decision, tags, warnings } = pictureState(picture, rows)
			warnings.forEach((warning) => logger.warn('Could not take over the decision of a sidecar', warning))
			if (!sameDecision(decision, UNDECIDED)) {
				decided.push({ picture, decision })
			}
			if (tags.length > 0) {
				tagged.push({ picture, tags })
			}
		}
		return { decided, tagged }
	}

	/** Keeps the rows, which the XMP export counts its sidecars by. */
	function rememberRows(more: readonly XmpCacheRow[]) {
		knownRows.value = new Map([...knownRows.value, ...more.map((row): [number, XmpCacheRow] => [row.fileId, row])])
	}

	/** The valid and stale rows the cache holds of the files; none, logged, when its lookup failed. */
	async function cachedRows(fileIds: readonly number[]): Promise<Map<number, XmpCacheRow>> {
		try {
			return new Map((await api.lookupXmpCache(fileIds)).map((row) => [row.fileId, row]))
		} catch (error) {
			logger.warn('Could not look up the XMP cache; every sidecar is read', { error })
			return new Map()
		}
	}

	/** The rows of the sources read now; a source not read has none. */
	async function readSources(stale: readonly XmpCacheSource[], pictures: Pictures): Promise<XmpCacheRow[]> {
		const leftOut = (tag: string) => logger.warn('A sidecar tag cannot be stored; it is left out', { tag })
		const sidecars = stale.filter(({ kind }) => kind === 'sidecar').map(({ entry }) => entry)
		const jpegs = stale.filter(({ kind }) => kind === 'embedded').map(({ entry }) => entry)
		const answers = await readOrWarn(sidecars, (ids) => api.lookupSidecars(ids, sizesOf(pictures)), 'Could not look up the sidecars; their pictures show what the cache holds')
		const embedded = await readOrWarn(jpegs, api.lookupEmbeddedXmp, 'Could not look up the embedded XMP; its pictures show no tags')
		const rows: XmpCacheRow[] = []
		for (const sidecar of sidecars) {
			const answer = answers.get(sidecar.fileId)
			if (answer?.result === 'read') {
				rows.push(sidecarRow(sidecar.fileId, answer.etag, answer.bytes, leftOut))
			} else if (answer !== undefined) {
				logger.warn('Could not read a sidecar', { path: sidecar.path, reason: answer.result })
			}
		}
		for (const jpeg of jpegs) {
			const answer = embedded.get(jpeg.fileId)
			const row = answer === undefined ? null : embeddedRow(jpeg, answer, leftOut)
			if (row !== null) {
				rows.push(row)
			} else if (answer !== undefined) {
				logger.warn('Could not read the embedded XMP; the picture shows no tags', { path: jpeg.path, reason: answer.result })
			}
		}
		return rows
	}

	/** The answers of the files' lookup by file id; none, logged, when the request failed. */
	async function readOrWarn<T>(entries: readonly ListingEntry[], request: (fileIds: readonly number[]) => Promise<T[]>, failure: string): Promise<Map<number, T>> {
		try {
			return await answersById(entries.map(({ fileId }) => fileId), request)
		} catch (error) {
			logger.warn(failure, { error })
			return new Map()
		}
	}

	/** Stores the rows in the cache; a failure only means they are read again next time. */
	async function storeRows(rows: readonly XmpCacheRow[]) {
		try {
			await api.saveXmpCache(rows)
		} catch (error) {
			logger.warn('Could not save the XMP cache; the sidecars are read again next time', { error })
		}
	}

	/** Writes the fields of each picture's decision, read when the write starts, to its sidecars as a delta; `paths` limits a picture to those sidecars. */
	function write(pictures: Pictures, decisionOf: (picture: Picture<ListingEntry>) => Decision, fields: readonly DecisionField[] = DECISION_FIELDS, paths?: Paths) {
		return queued({ pictures, decisionOf, fields, tags: null, paths })
	}

	/** Writes the tag change to each picture's sidecars, applied to their tags when the write starts; `paths` limits a picture to those sidecars. */
	function writeTags(pictures: Pictures, change: TagChange, paths?: Paths) {
		return queued({ pictures, decisionOf: null, tags: change, paths })
	}

	/** Answers the step's write once a pass has written it with the steps waiting beside it. */
	function queued(step: SidecarStep): Promise<Written> {
		return new Promise((resolve, reject) => {
			waiting.push({ step, resolve, reject })
			if (!passing) {
				passing = true
				void passes()
			}
		})
	}

	/** Runs one pass after another while steps wait, each over all that wait when it starts. */
	async function passes() {
		await Promise.resolve()
		while (waiting.length > 0) {
			const steps = waiting
			waiting = []
			const pass = passOf(steps.map(({ step }) => step))
			try {
				const failed = await writeNow(pass.pictures, pass.editOf, pass.paths)
				steps.forEach(({ step, resolve }) => resolve(stepResult(step, failed)))
			} catch (error) {
				steps.forEach(({ reject }) => reject(error))
			}
		}
		passing = false
	}

	/** One pass: a round, and one more for the sidecars that changed meanwhile; a failure carries a tag change for a retry. */
	async function writeNow(pictures: Pictures, editOf: EditOf, paths: Paths) {
		const first = await round(pictures, editOf, paths)
		const again = new Map<Picture<ListingEntry>, Set<string>>()
		first.changed.forEach(({ picture, path }) => again.set(picture, (again.get(picture) ?? new Set()).add(path)))
		const second = await round([...again.keys()], editOf, again)
		const failed = [...first.failed, ...second.failed, ...second.changed.map(({ path, picture }) => ({ path, picture, reason: 'changed' as const }))]
			.map((failure) => failureOf(failure, editOf(failure.picture)))
		if (failed.length > 0) {
			onFailed(failed)
		}
		return failed
	}

	/** Reads the sidecars honeycomb holds no bytes of, merges the edits and saves them in one request each. */
	async function round(pictures: Pictures, editOf: EditOf, paths?: Paths) {
		const answers = await lookUp(pictures.flatMap((picture) => writeLookups(picture, known.value, paths?.get(picture))), (ids) => api.lookupSidecars(ids, sizesOf(pictures)), 'Could not look up the sidecars to write')
		const embeddedIds = pictures.flatMap((picture) => embeddedXmpSource(picture, known.value)?.fileId ?? [])
		const embedded = await lookUp(embeddedIds, api.lookupEmbeddedXmp, 'Could not look up the embedded XMP to write')
		const time = now()
		const planned = pictures.map((picture) => planSaves(picture, editOf(picture), known.value, answers, time, paths?.get(picture), embedded))
		const saves = planned.flatMap(({ saves }) => saves)
		const saved = await save(saves)
		return { failed: [...planned.flatMap(({ failed }) => failed), ...saved.failed], changed: saved.changed }
	}

	/** The lookup's answers by file id; none, logged, when the request failed. */
	async function lookUp<T>(fileIds: number[], request: (fileIds: readonly number[]) => Promise<T[]>, failure: string): Promise<Map<number, T>> {
		try {
			return await answersById(fileIds, request)
		} catch (error) {
			logger.error(failure, { error })
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
		const applied = applySaves(saves, answers, known.value)
		known.value = applied.known
		own = recordSaves(own, saves, answers)
		const saved = savedSidecars(saves, answers ?? [])
		if (saved.length > 0) {
			onSaved(saved)
		}
		const savedNow = savedRows(saves, answers ?? [])
		rememberRows(savedNow)
		await storeRows(savedNow)
		return applied
	}

	/** The picture with its sidecars as honeycomb last saved them, which a delete sends (DELETE-002.17). */
	function current(picture: Picture<ListingEntry>) {
		return withOwnSaves(picture, own)
	}

	return { read, write, writeTags, current, known, rows: knownRows }
}

/** The lookup's answers by file id, without a request for no ids. */
async function answersById<T>(fileIds: readonly number[], request: (fileIds: readonly number[]) => Promise<T[]>): Promise<Map<number, T>> {
	if (fileIds.length === 0) {
		return new Map()
	}
	const answers = await request(fileIds)
	return new Map(fileIds.map((fileId, index) => [fileId, answers[index]!]))
}

/** The cache row of each sidecar saved, once per file: what honeycomb wrote there (XMP-006.10). */
function savedRows(saves: readonly PlannedSave[], answers: readonly SidecarSaveAnswer[]): XmpCacheRow[] {
	const rows = new Map<number, XmpCacheRow>()
	saves.forEach(({ item }, index) => {
		const answer = answers[index]
		if (answer?.result === 'saved') {
			rows.set(answer.fileId, sidecarRow(answer.fileId, answer.etag, item.bytes))
		}
	})
	return [...rows.values()]
}

/** The listed size of each sidecar of the pictures, by file id, which the lookup packs its requests by. */
function sizesOf(pictures: Pictures): Map<number, number> {
	return new Map(pictures.flatMap((picture) => picture.sidecars.map(({ fileId, size }): [number, number] => [fileId, size])))
}
