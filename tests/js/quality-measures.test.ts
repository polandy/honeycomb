// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { measureById, QUALITY_MEASURES } from '../../src/hashes/quality-measures.ts'
import { measureFetched } from '../../src/hashes/sharpness-drawing.ts'
import { SHARPNESS_METHOD } from '../../src/logic/sharpness.ts'

describe('the quality measure registry', () => {
	// spec: SERIES-006.22
	it('starts with the sharpness, which measures through the worker drawing', () => {
		expect(QUALITY_MEASURES[0]).toMatchObject({ id: 'sharpness', method: SHARPNESS_METHOD, slot: 'loupe-info', measure: measureFetched })
	})

	// spec: SERIES-006.22
	it('labels a measure in the translation it is given', () => {
		expect(measureById('sharpness').label((_app, text) => `<${text}>`)).toBe('<Sharpness>')
	})

	// spec: SERIES-006.22
	it('finds a measure by id', () => {
		expect(measureById('sharpness')).toBe(QUALITY_MEASURES[0])
	})

	// spec: SERIES-006.22
	it('fails for an unknown id', () => {
		expect(() => measureById('blur')).toThrow('Unknown quality measure blur')
	})

	// spec: SERIES-006.22
	it('gives every measure its own id and method', () => {
		expect(new Set(QUALITY_MEASURES.map(({ id }) => id)).size).toBe(QUALITY_MEASURES.length)
		expect(new Set(QUALITY_MEASURES.map(({ method }) => method)).size).toBe(QUALITY_MEASURES.length)
	})
})
