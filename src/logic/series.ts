// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { ListingEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The longest gap between two shots of one series, photo to photo (plan.md, Series compare). */
export const SERIES_GAP_SECONDS = 3

/** The most pictures one series shows side by side. */
const SERIES_SIZE = 4

interface Shot<P> {
	readonly picture: P
	readonly time: number
	readonly camera: string
}

/** The runs of shots by one camera with no gap over SERIES_GAP_SECONDS, at least two long, before any decision. */
export function seriesCandidates<P extends Picture<ListingEntry>>(pictures: readonly P[]): P[][] {
	const shots = pictures.flatMap((picture) => shotOf(picture) ?? [])
		.sort((a, b) => compare(a.camera, b.camera) || a.time - b.time || compare(a.picture.baseName, b.picture.baseName) || compare(a.picture.folder, b.picture.folder))
	return runs(shots, (previous, next) => previous.camera === next.camera).map((run) => run.map((shot) => shot.picture))
}

/** The series to compare: candidates without rejected pictures, split evenly to SERIES_SIZE, each with an unflagged picture, by first capture time. */
export function findSeries<P extends Picture<ListingEntry>>(candidates: readonly (readonly P[])[], decisionOf: (picture: P) => Decision): P[][] {
	return candidates
		.flatMap((candidate) => {
			const shots = candidate.filter((picture) => decisionOf(picture).flag !== 'rejected').map((picture) => shotOf(picture)!)
			return runs(shots, () => true).flatMap((run) => evenChunks(run.map((shot) => shot.picture)))
		})
		.filter((series) => series.some((picture) => decisionOf(picture).flag === 'unflagged'))
		.sort((a, b) => shotOf(a[0]!)!.time - shotOf(b[0]!)!.time)
}

/** The shot of a picture with an EXIF capture time, taken from its RAW member first; pictures without a camera share one. */
function shotOf<P extends Picture<ListingEntry>>(picture: P): Shot<P> | null {
	const members = [picture.raw, picture.rendered].filter((member) => member !== null)
	const time = members.find((member) => member.captureTime !== null)?.captureTime ?? null
	const camera = members.find((member) => member.camera !== null)?.camera ?? ''
	return time === null ? null : { picture, time, camera }
}

/** Sorted shots cut where `together` fails or the gap exceeds SERIES_GAP_SECONDS, keeping runs of two or more. */
function runs<P>(shots: readonly Shot<P>[], together: (previous: Shot<P>, next: Shot<P>) => boolean): Shot<P>[][] {
	const all: Shot<P>[][] = []
	shots.forEach((shot, index) => {
		const previous = shots[index - 1]
		if (previous !== undefined && together(previous, shot) && shot.time - previous.time <= SERIES_GAP_SECONDS) {
			all.at(-1)!.push(shot)
		} else {
			all.push([shot])
		}
	})
	return all.filter((run) => run.length > 1)
}

/** The run cut into as few chunks of at most SERIES_SIZE as possible, their sizes differing by one at most. */
function evenChunks<T>(run: readonly T[]): T[][] {
	const count = Math.ceil(run.length / SERIES_SIZE)
	const size = Math.floor(run.length / count)
	const larger = run.length % count
	return Array.from({ length: count }, (_, index) => {
		const start = index * size + Math.min(index, larger)
		return run.slice(start, start + size + (index < larger ? 1 : 0))
	})
}

/** Orders strings by code unit, independent of the locale. */
function compare(a: string, b: string): number {
	return a < b ? -1 : a > b ? 1 : 0
}

/** Each picture of the given series mapped to the size of its series, for the series badge (SERIES-002.10). */
export function seriesSizes<P>(series: readonly (readonly P[])[]): Map<P, number> {
	return new Map(series.flatMap((pictures) => pictures.map((picture) => [picture, pictures.length] as const)))
}
