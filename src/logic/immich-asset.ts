// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { SourceEntry } from './listing.ts'
import type { Picture } from './pairing.ts'
import type { PictureId } from './picture-id.ts'

import { parseFileName } from './file-name.ts'

/** What an Immich asset is: a photo, a live photo with its motion part, or a video (ADR 0044). */
export type ImmichKind = 'photo' | 'live' | 'video'

/** One entry of the Immich listing (IMMICH-002.4) with its decision (ADR 0043); times are Unix seconds. */
export interface ImmichEntry extends Decision {
	readonly assetId: string
	readonly name: string
	readonly takenAt: number
	readonly cameraModel: string | null
	readonly kind: ImmichKind
	readonly width: number | null
	readonly height: number | null
	/** Seconds of a video or a live photo's motion part, `null` for a photo. */
	readonly duration: number | null
	/** The size of the stack the entry is the primary asset of, `null` outside a stack. */
	readonly stackSize: number | null
	/** Immich's own, as a string; it names the preview's URL and the write's conflict check. */
	readonly updatedAt: string
}

/** One row of the decision save (ADR 0043): the whole decision and the asset fields the table keeps. */
export interface DecisionRow extends Decision {
	readonly assetId: string
	readonly takenAt: number
	readonly cameraModel: string | null
	readonly kind: ImmichKind
	readonly assetUpdatedAt: string
}

/** The image sizes honeycomb fetches from Immich: the grid's and the loupe's (IMMICH-002.16). */
export type ImmichImageSize = 'thumbnail' | 'preview'

/** An Immich asset as the grid's and the loupe's member: a listing-like file under a grid id. */
export interface ImmichSourceEntry extends SourceEntry {
	readonly asset: ImmichEntry
}

/** Immich's rendered images are JPEGs; a video's member stands for its poster frame. */
const MIME_OF: Readonly<Record<ImmichKind, string>> = { photo: 'image/jpeg', live: 'image/jpeg', video: 'video/mp4' }

/** An Immich asset as a picture under its grid id and day group: a single rendered member, no RAW, no sidecars. */
export function assetPicture(entry: ImmichEntry, fileId: PictureId, day: string): Picture<ImmichSourceEntry> {
	const rendered: ImmichSourceEntry = {
		fileId,
		path: entry.name,
		mtime: entry.takenAt,
		mime: MIME_OF[entry.kind],
		captureTime: entry.takenAt,
		orientation: null,
		width: entry.width,
		height: entry.height,
		camera: entry.cameraModel,
		flag: entry.flag,
		keepRaw: entry.keepRaw,
		flagUpdated: null,
		asset: entry,
	}
	return { raw: null, rendered, folder: day, baseName: parseFileName(entry.name).baseName, sidecars: [], ambiguous: false }
}

/** The decision the entry carries. */
export function assetDecision(entry: ImmichEntry): Decision {
	return { rating: entry.rating, colourLabel: entry.colourLabel, flag: entry.flag, keepRaw: entry.keepRaw }
}

/** The entry with a new decision. */
export function withDecision(entry: ImmichEntry, decision: Decision): ImmichEntry {
	return { ...entry, ...decision }
}

/** The save row of the asset's whole new decision. */
export function decisionRow(entry: ImmichEntry, decision: Decision): DecisionRow {
	return { assetId: entry.assetId, ...decision, takenAt: entry.takenAt, cameraModel: entry.cameraModel, kind: entry.kind, assetUpdatedAt: entry.updatedAt }
}
