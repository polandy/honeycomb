// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionField } from './logic/decision.ts'
import type { EmbeddedXmpAnswer } from './logic/embedded-xmp.ts'
import type { DecisionFlow, SkippedPicture } from './logic/fresh-check.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { SidecarFailure, SidecarLookupAnswer } from './logic/sidecar-sync.ts'
import type { Tag, TagChange } from './logic/tag.ts'

import { logger } from './logger.ts'
import { DECISION_FIELDS } from './logic/decision.ts'
import { freshFolders, freshLookups, freshVerdict, goesUnchecked, matchFresh } from './logic/fresh-check.ts'
import { mergeListings } from './logic/listing.ts'
import { pairPictures } from './logic/pairing.ts'

/** The requests the fresh check makes. */
export interface FreshCheckApi {
	listEntries(path: string, subfolders: boolean): Promise<{ readonly entries: readonly ListingEntry[] }>
	lookupSidecars(fileIds: readonly number[], sizes?: ReadonlyMap<number, number>): Promise<SidecarLookupAnswer[]>
	lookupEmbeddedXmp(fileIds: readonly number[]): Promise<EmbeddedXmpAnswer[]>
}

/** What the fresh check needs of the cull: the pairing, whether a picture's sidecars may be written, and a save of one sidecar. */
export interface FreshCheckContext {
	pairing(): PairingSettings
	writable(picture: Picture<ListingEntry>): boolean
	writeSidecar(picture: Picture<ListingEntry>, path: string, decision: Decision, tags: readonly Tag[]): Promise<boolean>
}

/** The fresh pictures that pass, those skipped with their reason, and those that go as the cull knows them because a request failed. */
export interface FreshCheckResult {
	readonly passed: readonly Picture<ListingEntry>[]
	readonly skipped: readonly SkippedPicture[]
	readonly unchecked: readonly Picture<ListingEntry>[]
}

/** The sidecar sync's writes the saver uses. */
interface SidecarWrites {
	write(pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, fields: readonly DecisionField[], paths: ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>): Promise<{ readonly failed: readonly SidecarFailure[] }>
	writeTags(pictures: readonly Picture<ListingEntry>[], change: TagChange, paths: ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>): Promise<{ readonly failed: readonly SidecarFailure[] }>
}

/** Saves one sidecar of a picture through the sidecar sync: the decision, then the tags; true when nothing failed. */
export function sidecarSaver(sync: SidecarWrites): FreshCheckContext['writeSidecar'] {
	return async (picture, path, decision, tags) => {
		const paths = new Map([[picture, new Set([path])]])
		const decided = await sync.write([picture], () => decision, DECISION_FIELDS, paths)
		const tagged = tags.length === 0 ? { failed: [] } : await sync.writeTags([picture], { added: tags, removed: [] }, paths)
		return decided.failed.length === 0 && tagged.failed.length === 0
	}
}

/** The answers of a request, or `null` after logging its failure. */
async function settled<T>(request: () => Promise<T>, message: string): Promise<T | null> {
	try {
		return await request()
	} catch (error) {
		logger.error(message, { error })
		return null
	}
}

/**
 * Lists the pictures' folders again, reads their sidecars and keeps only what every sidecar lets go (ADR 0032 Deleting by decision).
 * A picture whose folder listing or lookup failed goes unchecked, as the cull knows it (DELETE-002.23).
 */
export function freshCheck(api: FreshCheckApi, context: FreshCheckContext) {
	return async (pictures: readonly Picture<ListingEntry>[], flow: DecisionFlow): Promise<FreshCheckResult> => {
		if (pictures.length === 0) {
			return { passed: [], skipped: [], unchecked: [] }
		}
		const folders = freshFolders(pictures)
		const listings = await Promise.all(folders.map((folder) => settled(async () => (await api.listEntries(folder, false)).entries, 'Could not list the folder afresh; deleting as known')))
		const failed = new Set(folders.filter((_, index) => listings[index] === null))
		const entries = mergeListings(listings.filter((listing) => listing !== null))
		const listed = pictures.filter((picture) => !freshFolders([picture]).some((folder) => failed.has(folder)))
		const { matched, skipped } = matchFresh(listed, pairPictures(entries, context.pairing()))
		const { sidecars, embedded } = freshLookups(matched.map(({ fresh }) => fresh))
		const sizes = new Map(entries.map((entry) => [entry.fileId, entry.size]))
		const [sidecarAnswers, embeddedAnswers] = await Promise.all([
			sidecars.length === 0 ? [] : settled(() => api.lookupSidecars(sidecars, sizes), 'Could not read the sidecars afresh; deleting as known'),
			embedded.length === 0 ? [] : settled(() => api.lookupEmbeddedXmp(embedded), 'Could not read the embedded XMP afresh; deleting as known'),
		])
		const answers = new Map(sidecarAnswers === null ? [] : sidecars.map((fileId, index) => [fileId, sidecarAnswers[index]!]))
		const inJpegs = new Map(embeddedAnswers === null ? [] : embedded.map((fileId, index) => [fileId, embeddedAnswers[index]!]))
		const unread = (fresh: Picture<ListingEntry>) => {
			const { sidecars: ids, embedded: jpegs } = freshLookups([fresh])
			return (sidecarAnswers === null && ids.length > 0) || (embeddedAnswers === null && jpegs.length > 0)
		}
		const passed: Picture<ListingEntry>[] = []
		const held: SkippedPicture[] = [...skipped]
		const known = pictures.filter((picture) => !listed.includes(picture))
		for (const { picture, fresh } of matched) {
			if (unread(fresh)) {
				known.push(picture)
				continue
			}
			const verdict = freshVerdict(flow, fresh, answers, inJpegs)
			if ('reason' in verdict) {
				held.push({ picture, reason: verdict.reason })
			} else if (verdict.jpegSidecar !== null && !(context.writable(fresh) && await context.writeSidecar(fresh, verdict.jpegSidecar, verdict.decision, verdict.tags))) {
				held.push({ picture, reason: 'jpegSidecar' })
			} else {
				passed.push(fresh)
			}
		}
		held.push(...known.filter((picture) => !goesUnchecked(flow, picture)).map((picture) => ({ picture, reason: 'unread' as const })))
		return { passed, skipped: held, unchecked: known.filter((picture) => goesUnchecked(flow, picture)) }
	}
}
