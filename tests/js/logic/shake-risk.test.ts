// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Exposure } from '../../../src/logic/shake-risk.ts'

import { describe, expect, it } from 'vitest'
import { exposureText, pictureExposure, shakeRisk } from '../../../src/logic/shake-risk.ts'
import { listingEntry, pictureOf } from './listing-entries.ts'

/** The facts of a shot with the given fields, the rest unknown. */
function exposure(fields: Partial<Exposure>): Exposure {
	return { exposureTime: null, focalLength: null, focalLength35: null, aperture: null, iso: null, ...fields }
}

describe('shakeRisk', () => {
	// spec: SERIES-009.1
	it('flags an exposure longer than the reciprocal of the full-frame focal length', () => {
		expect(shakeRisk(exposure({ exposureTime: 1 / 15, focalLength: 200, focalLength35: 300 }))).toEqual({ exposureTime: 1 / 15, focalLength: 300, fullFrame: true })
	})

	// spec: SERIES-009.1
	it.each([
		['faster than the limit', exposure({ exposureTime: 1 / 500, focalLength35: 300 })],
		['exactly at the limit', exposure({ exposureTime: 1 / 300, focalLength35: 300 })],
		['a wide lens', exposure({ exposureTime: 1 / 15, focalLength: 8, focalLength35: 12 })],
	])('does not flag %s', (_name, facts) => {
		expect(shakeRisk(facts)).toBeNull()
	})

	// spec: SERIES-009.1
	it('takes the focal length as shot where there is no full-frame value', () => {
		expect(shakeRisk(exposure({ exposureTime: 1 / 30, focalLength: 50 }))).toEqual({ exposureTime: 1 / 30, focalLength: 50, fullFrame: false })
		expect(shakeRisk(exposure({ exposureTime: 1 / 60, focalLength: 50 }))).toBeNull()
	})

	// spec: SERIES-009.1
	it.each([
		['no facts', null],
		['no exposure time', exposure({ focalLength35: 300 })],
		['no focal length', exposure({ exposureTime: 2 })],
	])('has no judgement for %s', (_name, facts) => {
		expect(shakeRisk(facts)).toBeNull()
	})
})

describe('pictureExposure', () => {
	const rawFacts = exposure({ exposureTime: 1 / 15, focalLength35: 300 })
	const jpegFacts = exposure({ exposureTime: 1 / 1000, focalLength35: 300 })

	// spec: SERIES-009.2
	it('prefers the RAW member', () => {
		const pair = pictureOf(listingEntry(1, '/P/A.NEF', { exposure: rawFacts }), listingEntry(2, '/P/A.JPG', { exposure: jpegFacts }))
		expect(pictureExposure(pair)).toBe(rawFacts)
	})

	// spec: SERIES-009.2
	it('falls back to the JPEG when the RAW has none', () => {
		const pair = pictureOf(listingEntry(1, '/P/A.NEF'), listingEntry(2, '/P/A.JPG', { exposure: jpegFacts }))
		expect(pictureExposure(pair)).toBe(jpegFacts)
	})

	// spec: SERIES-009.2
	it('is null for a picture without facts', () => {
		expect(pictureExposure(pictureOf(listingEntry(1, '/P/A.JPG')))).toBeNull()
	})
})

describe('exposureText', () => {
	it.each([
		[exposure({ exposureTime: 1 / 15, aperture: 5.6, iso: 800 }), '1/15 s · f/5.6 · ISO 800'],
		[exposure({ exposureTime: 2, iso: 100 }), '2 s · ISO 100'],
		[exposure({ exposureTime: 0.8 }), '0.8 s'],
		[exposure({ aperture: 2 }), 'f/2'],
		[exposure({}), null],
	])('writes %j as %s', (facts, text) => {
		expect(exposureText(facts)).toBe(text)
	})
})
