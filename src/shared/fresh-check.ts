// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionFlow, SkippedPicture } from '../logic/fresh-check.ts'
import type { ListingEntry } from '../logic/listing.ts'
import type { PairingSettings, Picture } from '../logic/pairing.ts'

import { freshFolders, jpegSidecarOf, matchFresh } from '../logic/fresh-check.ts'
import { mergeListings } from '../logic/listing.ts'
import { pairPictures } from '../logic/pairing.ts'
import { logger } from './logger.ts'

/** The request the fresh check makes. */
export interface FreshCheckApi {
	listEntries(path: string, subfolders: boolean): Promise<{ readonly entries: readonly ListingEntry[] }>
}

/** What the fresh check needs of the cull: the pairing, whether a picture's sidecars may be written, and the seed of a JPEG sidecar from a RAW sidecar. */
export interface FreshCheckContext {
	pairing(): PairingSettings
	writable(picture: Picture<ListingEntry>): boolean
	seedSidecar(picture: Picture<ListingEntry>, path: string, source: ListingEntry): Promise<boolean>
}

/** The fresh pictures that pass and those skipped with their reason. */
export interface FreshCheckResult {
	readonly passed: readonly Picture<ListingEntry>[]
	readonly skipped: readonly SkippedPicture[]
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
 * Before *Remove RAWs*, a pair whose RAW alone has a sidecar first gets a JPEG sidecar seeded from it (DELETE-003.12).
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
			const jpegSidecar = flow === 'raws' ? jpegSidecarOf(fresh) : null
			if (jpegSidecar !== null && !(context.writable(fresh) && await context.seedSidecar(fresh, jpegSidecar.path, jpegSidecar.source))) {
				held.push({ picture, reason: 'jpegSidecar' })
			} else {
				passed.push(fresh)
			}
		}
		return { passed, skipped: held }
	}
}
