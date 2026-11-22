// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { BURST_GAP_SECONDS, folderReason, folderScore } from '../../../src/logic/folder-score.ts'
import { SERIES_GAP_SECONDS } from '../../../src/logic/series.ts'
import { row } from './folder-fixtures.ts'

const MB = 1024 * 1024
const GB = 1024 * MB

describe('folderScore', () => {
	// spec: FOLDERS-001.1
	it('multiplies the undecided photos by the burst and the size factor', () => {
		expect(folderScore(row({ photos: 100, undecided: 10, bursts: 50, bytes: 100 * 25 * MB }))).toBe(40)
	})

	// spec: FOLDERS-001.2
	it('is 0 without photos', () => {
		expect(folderScore(row({ photos: 0, undecided: 0, bursts: 0, bytes: 0 }))).toBe(0)
	})

	// spec: FOLDERS-001.3
	it('caps the burst factor at 3 and the size factor at 2', () => {
		expect(folderScore(row({ photos: 100, undecided: 10, bursts: 100, bytes: 100 * 80 * MB }))).toBe(60)
		expect(folderScore(row({ photos: 100, undecided: 10, bursts: 0, bytes: 100 * 5 * MB }))).toBeCloseTo(10 * (1 + 5 / 25))
	})
})

describe('folderReason', () => {
	// spec: FOLDERS-001.4
	it('words the undecided share, bursts, size and year, never the score', () => {
		const folder = row({ photos: 100, undecided: 63, bursts: 18, bytes: 4.2 * GB, oldest: Date.UTC(2019, 6, 1) / 1000 })
		expect(folderReason(folder)).toBe('63 % undecided · 18 in bursts · 4.2 GB · 2019')
	})

	// spec: FOLDERS-001.5
	it('leaves out bursts and year without a value and shows MB below 1 GB', () => {
		expect(folderReason(row({ photos: 200, undecided: 100, bursts: 0, bytes: 300 * MB, oldest: null }))).toBe('50 % undecided · 300 MB')
		expect(folderReason(row({ bytes: 12 * GB, oldest: null }))).toBe('40 % undecided · 12 GB')
		expect(folderReason(row({ photos: 0, undecided: 0, bytes: 0, oldest: null }))).toBe('0 % undecided · 0 MB')
	})
})

describe('BURST_GAP_SECONDS', () => {
	// spec: FOLDERS-001.6
	it('is the series gap and the 3 s of ADR 0049', () => {
		expect(BURST_GAP_SECONDS).toBe(SERIES_GAP_SECONDS)
		expect(BURST_GAP_SECONDS).toBe(3)
	})
})
