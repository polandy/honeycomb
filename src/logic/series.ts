// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

import { pictureMembers } from './pairing.ts'
import { hashDistance } from './visual-hash.ts'

/** The longest gap between two shots of one series, photo to photo, where one has no visual hash (plan.md, Series compare). */
export const SERIES_GAP_SECONDS = 3

/** The longest gap between two shots of one series that look alike, photo to photo (ADR 0024). */
export const VISUAL_SERIES_GAP_SECONDS = 30

/** The longest time from a series' first shot to its last; a later shot starts the next series (ADR 0024). */
export const SERIES_SPAN_SECONDS = 60

/** The most bits in which the visual hashes of two shots that look alike differ, of 64 (ADR 0024). */
export const VISUAL_DISTANCE_LIMIT = 10

/** The visual hash of a picture, or null while it has none. */
export type HashOf<P> = (picture: P) => string | null

/** Without visual hashes, series follow the time rule alone. */
const noHashes = () => null

interface Shot<P> {
	readonly picture: P
	readonly time: number
	readonly camera: string
	readonly hash: string | null
}

/** The runs of linked shots by one camera, at least two long, before any decision. */
export function seriesCandidates<P extends Picture<ListingEntry>>(pictures: readonly P[], hashOf: HashOf<P> = noHashes): P[][] {
	return runs(cameraShots(pictures, hashOf), (previous, next) => previous.camera === next.camera && linked(previous, next)).map(picturesOfRun)
}

/** The pictures whose visual hash could link them into a series: a shot of the same camera lies within VISUAL_SERIES_GAP_SECONDS. */
export function hashablePictures<P extends Picture<ListingEntry>>(pictures: readonly P[]): P[] {
	return runs(cameraShots(pictures, noHashes), (previous, next) => previous.camera === next.camera && next.time - previous.time <= VISUAL_SERIES_GAP_SECONDS).flatMap(picturesOfRun)
}

/** Every series, decided or not: candidates without rejected pictures, linked again and cut at the span, by first capture time. */
export function allSeries<P extends Picture<ListingEntry>>(candidates: readonly (readonly P[])[], decisionOf: (picture: P) => Decision, hashOf: HashOf<P> = noHashes): P[][] {
	return candidates
		.flatMap((candidate) => {
			const shots = candidate.filter((picture) => decisionOf(picture).flag !== 'rejected').map((picture) => shotOf(picture, hashOf)!)
			return runs(shots, (previous, next, first) => linked(previous, next) && next.time - first.time <= SERIES_SPAN_SECONDS).map(picturesOfRun)
		})
		.sort((a, b) => shotOf(a[0]!, noHashes)!.time - shotOf(b[0]!, noHashes)!.time)
}

/** The series to compare: every series with an unflagged picture. */
export function findSeries<P extends Picture<ListingEntry>>(candidates: readonly (readonly P[])[], decisionOf: (picture: P) => Decision, hashOf: HashOf<P> = noHashes): P[][] {
	return allSeries(candidates, decisionOf, hashOf).filter((series) => series.some((picture) => decisionOf(picture).flag === 'unflagged'))
}

/** Whether two shots in capture-time order belong together: alike within the visual gap, or within the time gap while one has no hash. */
function linked<P>(previous: Shot<P>, next: Shot<P>): boolean {
	const gap = next.time - previous.time
	return previous.hash !== null && next.hash !== null
		? gap <= VISUAL_SERIES_GAP_SECONDS && hashDistance(previous.hash, next.hash) <= VISUAL_DISTANCE_LIMIT
		: gap <= SERIES_GAP_SECONDS
}

/** The shots of the pictures with a capture time, by camera, then capture time, then name. */
function cameraShots<P extends Picture<ListingEntry>>(pictures: readonly P[], hashOf: HashOf<P>): Shot<P>[] {
	return pictures.flatMap((picture) => shotOf(picture, hashOf) ?? [])
		.sort((a, b) => compare(a.camera, b.camera) || a.time - b.time || compare(a.picture.baseName, b.picture.baseName) || compare(a.picture.folder, b.picture.folder))
}

/** The shot of a picture with an EXIF capture time, taken from its RAW member first; pictures without a camera share one. */
function shotOf<P extends Picture<ListingEntry>>(picture: P, hashOf: HashOf<P>): Shot<P> | null {
	const members = pictureMembers(picture)
	const time = members.find((member) => member.captureTime !== null)?.captureTime ?? null
	const camera = members.find((member) => member.camera !== null)?.camera ?? ''
	return time === null ? null : { picture, time, camera, hash: hashOf(picture) }
}

/** The pictures of a run of shots. */
function picturesOfRun<P>(run: readonly Shot<P>[]): P[] {
	return run.map((shot) => shot.picture)
}

/** Sorted shots cut where `together` fails, given the run's first shot, keeping runs of two or more. */
function runs<P>(shots: readonly Shot<P>[], together: (previous: Shot<P>, next: Shot<P>, first: Shot<P>) => boolean): Shot<P>[][] {
	const all: Shot<P>[][] = []
	shots.forEach((shot) => {
		const run = all.at(-1)
		if (run !== undefined && together(run.at(-1)!, shot, run[0]!)) {
			run.push(shot)
		} else {
			all.push([shot])
		}
	})
	return all.filter((run) => run.length > 1)
}

/** Orders strings by code unit, independent of the locale. */
function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0
}

/** Each picture of the given series mapped to the size of its series, for the series badge (SERIES-002.10). */
export function seriesSizes<P>(series: readonly (readonly P[])[]): Map<P, number> {
	return new Map(series.flatMap((pictures) => pictures.map((picture) => [picture, pictures.length] as const)))
}

/** Each picture of the given series mapped to its whole series, for the filmstrip's frame (LOUPE-001.19). */
export function seriesMembers<P>(series: readonly (readonly P[])[]): Map<P, readonly P[]> {
	return new Map(series.flatMap((pictures) => pictures.map((picture) => [picture, pictures] as const)))
}
