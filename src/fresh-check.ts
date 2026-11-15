// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionField } from './logic/decision.ts'
import type { EmbeddedXmpAnswer } from './logic/embedded-xmp.ts'
import type { DecisionFlow, SkippedPicture } from './logic/fresh-check.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { SidecarFailure, SidecarLookupAnswer } from './logic/sidecar-sync.ts'
import type { Tag, TagChange } from './logic/tag.ts'

import { DECISION_FIELDS } from './logic/decision.ts'
import { freshFolders, freshLookups, freshVerdict, matchFresh } from './logic/fresh-check.ts'
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

/** The fresh pictures that pass, and those skipped with their reason. */
export interface FreshCheckResult {
	readonly passed: readonly Picture<ListingEntry>[]
	readonly skipped: readonly SkippedPicture[]
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

/** Lists the pictures' folders again, reads their sidecars and keeps only what every sidecar lets go (ADR 0032 Deleting by decision); a failed request rejects. */
export function freshCheck(api: FreshCheckApi, context: FreshCheckContext) {
	return async (pictures: readonly Picture<ListingEntry>[], flow: DecisionFlow): Promise<FreshCheckResult> => {
		if (pictures.length === 0) {
			return { passed: [], skipped: [] }
		}
		const listings = await Promise.all(freshFolders(pictures).map(async (folder) => (await api.listEntries(folder, false)).entries))
		const entries = mergeListings(listings)
		const { matched, skipped } = matchFresh(pictures, pairPictures(entries, context.pairing()))
		const { sidecars, embedded } = freshLookups(matched.map(({ fresh }) => fresh))
		const sizes = new Map(entries.map((entry) => [entry.fileId, entry.size]))
		const [sidecarAnswers, embeddedAnswers] = await Promise.all([
			sidecars.length === 0 ? [] : api.lookupSidecars(sidecars, sizes),
			embedded.length === 0 ? [] : api.lookupEmbeddedXmp(embedded),
		])
		const answers = new Map(sidecars.map((fileId, index) => [fileId, sidecarAnswers[index]!]))
		const inJpegs = new Map(embedded.map((fileId, index) => [fileId, embeddedAnswers[index]!]))
		const passed: Picture<ListingEntry>[] = []
		const held: SkippedPicture[] = [...skipped]
		for (const { picture, fresh } of matched) {
			const verdict = freshVerdict(flow, fresh, answers, inJpegs)
			if ('reason' in verdict) {
				held.push({ picture, reason: verdict.reason })
			} else if (verdict.jpegSidecar !== null && !(context.writable(fresh) && await context.writeSidecar(fresh, verdict.jpegSidecar, verdict.decision, verdict.tags))) {
				held.push({ picture, reason: 'jpegSidecar' })
			} else {
				passed.push(fresh)
			}
		}
		return { passed, skipped: held }
	}
}
