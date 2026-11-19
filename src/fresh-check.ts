// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision, DecisionField } from './logic/decision.ts'
import type { DecisionFlow, SkippedPicture } from './logic/fresh-check.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { PairingSettings, Picture } from './logic/pairing.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { Tag, TagChange } from './logic/tag.ts'

import { logger } from './logger.ts'
import { freshFolders, jpegSidecarOf, matchFresh } from './logic/fresh-check.ts'
import { mergeListings } from './logic/listing.ts'
import { pairPictures } from './logic/pairing.ts'

/** The fields the JPEG sidecar gets before the RAW goes; the flag stays in the rows (DELETE-003.12). */
const JPEG_SIDECAR_FIELDS: readonly DecisionField[] = ['rating', 'colourLabel']

/** The request the fresh check makes. */
export interface FreshCheckApi {
	listEntries(path: string, subfolders: boolean): Promise<{ readonly entries: readonly ListingEntry[] }>
}

/** What the fresh check needs of the cull: the pairing, a picture's shown state, whether its sidecars may be written, and a save of one sidecar. */
export interface FreshCheckContext {
	pairing(): PairingSettings
	writable(picture: Picture<ListingEntry>): boolean
	decisionOf(picture: Picture<ListingEntry>): Decision
	tagsOf(picture: Picture<ListingEntry>): readonly Tag[]
	writeSidecar(picture: Picture<ListingEntry>, path: string, decision: Decision, tags: readonly Tag[]): Promise<boolean>
}

/** The fresh pictures that pass and those skipped with their reason. */
export interface FreshCheckResult {
	readonly passed: readonly Picture<ListingEntry>[]
	readonly skipped: readonly SkippedPicture[]
}

/** The sidecar sync's writes the saver uses. */
interface SidecarWrites {
	write(pictures: readonly Picture<ListingEntry>[], decisionOf: (picture: Picture<ListingEntry>) => Decision, fields: readonly DecisionField[], paths: ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>): Promise<{ readonly failed: readonly SidecarFailure[] }>
	writeTags(pictures: readonly Picture<ListingEntry>[], change: TagChange, paths: ReadonlyMap<Picture<ListingEntry>, ReadonlySet<string>>): Promise<{ readonly failed: readonly SidecarFailure[] }>
}

/** Saves one sidecar of a picture through the sidecar sync: the rating and colour label, then the tags; true when nothing failed. */
export function sidecarSaver(sync: SidecarWrites): FreshCheckContext['writeSidecar'] {
	return async (picture, path, decision, tags) => {
		const paths = new Map([[picture, new Set([path])]])
		const decided = await sync.write([picture], () => decision, JPEG_SIDECAR_FIELDS, paths)
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
 * Lists the pictures' folders again and keeps the pictures whose members are unchanged; the server checks the flags (ADR 0040).
 * Before *Remove RAWs*, a pair whose RAW alone has a sidecar first gets a JPEG sidecar with the values the cull shows (DELETE-003.12).
 */
export function freshCheck(api: FreshCheckApi, context: FreshCheckContext) {
	return async (pictures: readonly Picture<ListingEntry>[], flow: DecisionFlow): Promise<FreshCheckResult> => {
		if (pictures.length === 0) {
			return { passed: [], skipped: [] }
		}
		const folders = freshFolders(pictures)
		const listings = await Promise.all(folders.map((folder) => settled(async () => (await api.listEntries(folder, false)).entries, 'Could not list the folder again; its pictures are skipped')))
		const failed = new Set(folders.filter((_, index) => listings[index] === null))
		const unlisted = (picture: Picture<ListingEntry>) => freshFolders([picture]).some((folder) => failed.has(folder))
		const entries = mergeListings(listings.filter((listing) => listing !== null))
		const { matched, skipped } = matchFresh(pictures.filter((picture) => !unlisted(picture)), pairPictures(entries, context.pairing()))
		const passed: Picture<ListingEntry>[] = []
		const held: SkippedPicture[] = [...pictures.filter(unlisted).map((picture) => ({ picture, reason: 'unlisted' as const })), ...skipped]
		for (const { picture, fresh } of matched) {
			const decision = context.decisionOf(picture)
			const tags = context.tagsOf(picture)
			const jpegSidecar = flow === 'raws' ? jpegSidecarOf(fresh, decision, tags) : null
			if (jpegSidecar !== null && !(context.writable(fresh) && await context.writeSidecar(fresh, jpegSidecar, decision, tags))) {
				held.push({ picture, reason: 'jpegSidecar' })
			} else {
				passed.push(fresh)
			}
		}
		return { passed, skipped: held }
	}
}
