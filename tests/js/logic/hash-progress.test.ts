// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { hashProgress, progressStep } from '../../../src/logic/hash-progress.ts'

describe('hashProgress', () => {
	// spec: SERIES-003.18
	it('runs while a picture is pending and counts the hashed of the hashable', () => {
		expect(hashProgress(['hashed', 'pending', 'failed', 'hashed'], false)).toEqual({ phase: 'running', hashed: 2, failed: 1, total: 4 })
	})

	// spec: SERIES-003.18
	it('runs while pending even after a failed save', () => {
		expect(hashProgress(['pending'], true).phase).toBe('running')
	})

	// spec: SERIES-003.19
	it('fails once none is pending and one failed', () => {
		expect(hashProgress(['hashed', 'failed'], false)).toEqual({ phase: 'failed', hashed: 1, failed: 1, total: 2 })
	})

	// spec: SERIES-003.19
	it('fails once none is pending and the last save failed', () => {
		expect(hashProgress(['hashed'], true).phase).toBe('failed')
	})

	// spec: SERIES-003.20
	it('is done when every picture is hashed and saved, or none is hashable', () => {
		expect(hashProgress(['hashed', 'hashed'], false).phase).toBe('done')
		expect(hashProgress([], false)).toEqual({ phase: 'done', hashed: 0, failed: 0, total: 0 })
	})
})

describe('progressStep', () => {
	// spec: SERIES-003.24
	it('rounds the hashed share down to a step of 10 %', () => {
		expect([0, 199, 200, 640, 1999, 2000].map((hashed) => progressStep({ phase: 'running', hashed, failed: 0, total: 2000 }))).toEqual([0, 0, 10, 30, 90, 100])
	})

	// spec: SERIES-003.24
	it('is 100 without a hashable picture', () => {
		expect(progressStep({ phase: 'done', hashed: 0, failed: 0, total: 0 })).toBe(100)
	})
})
