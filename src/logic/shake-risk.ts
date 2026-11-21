// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SourceEntry } from './listing.ts'
import type { Picture } from './pairing.ts'

/** The EXIF exposure facts of one file, each `null` where unknown; seconds and millimetres (ADR 0046). */
export interface Exposure {
	readonly exposureTime: number | null
	readonly focalLength: number | null
	readonly focalLength35: number | null
	readonly aperture: number | null
	readonly iso: number | null
}

/** Why a photo is at risk: its exposure time and the focal length the rule used. */
export interface ShakeRisk {
	readonly exposureTime: number
	/** The full-frame focal length, else the one as shot. */
	readonly focalLength: number
	readonly fullFrame: boolean
}

/** The facts of the picture's RAW member, else of its JPEG (SERIES-009.2); null for a picture without them. */
export function pictureExposure(picture: Picture<SourceEntry>): Exposure | null {
	for (const member of [picture.raw, picture.rendered]) {
		const facts = member !== null && 'exposure' in member ? member.exposure as Exposure | null : null
		if (facts !== null) {
			return facts
		}
	}
	return null
}

/** The risk when the exposure time is longer than the reciprocal of the focal length (SERIES-009.1). */
export function shakeRisk(exposure: Exposure | null): ShakeRisk | null {
	if (exposure === null || exposure.exposureTime === null) {
		return null
	}
	const fullFrame = exposure.focalLength35 !== null
	const focalLength = exposure.focalLength35 ?? exposure.focalLength
	return focalLength !== null && exposure.exposureTime > 1 / focalLength
		? { exposureTime: exposure.exposureTime, focalLength, fullFrame }
		: null
}

/** The shake risk of the picture's facts. */
export function pictureShakeRisk(picture: Picture<SourceEntry>): ShakeRisk | null {
	return shakeRisk(pictureExposure(picture))
}

/** An exposure time as a camera writes it: `1/15 s` below a second, `2 s` or `0.8 s` above. */
export function exposureTimeText(seconds: number): string {
	return seconds >= 0.5 ? `${Number(seconds.toFixed(1))} s` : `1/${Math.round(1 / seconds)} s`
}

/** `1/15 s · f/5.6 · ISO 800` with each unknown part left out, null while all are. */
export function exposureText(exposure: Exposure): string | null {
	const parts = [
		exposure.exposureTime === null ? null : exposureTimeText(exposure.exposureTime),
		exposure.aperture === null ? null : `f/${Number(exposure.aperture.toFixed(1))}`,
		exposure.iso === null ? null : `ISO ${exposure.iso}`,
	].filter((part) => part !== null)
	return parts.length === 0 ? null : parts.join(' · ')
}
