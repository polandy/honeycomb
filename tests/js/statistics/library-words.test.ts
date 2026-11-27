// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { forecastNote, forecastText } from '../../../src/statistics/library-words.ts'

describe('the library forecast words', () => {
	// spec: STATS-001.84
	it.each([
		[{ kind: 'days', count: 1 } as const, 'About 1 day'],
		[{ kind: 'days', count: 13 } as const, 'About 13 days'],
		[{ kind: 'weeks', count: 1 } as const, 'About 1 week'],
		[{ kind: 'weeks', count: 2 } as const, 'About 2 weeks'],
		[{ kind: 'months', count: 1 } as const, 'About 1 month'],
		[{ kind: 'months', count: 4 } as const, 'About 4 months'],
		[{ kind: 'grows' } as const, 'At this pace the backlog grows'],
	])('says %o as "%s"', (forecast, text) => {
		expect(forecastText(forecast)).toBe(text)
	})

	// spec: STATS-001.84
	it('names the 90 days the pace is read from', () => {
		expect(forecastNote({ kind: 'weeks', count: 2 })).toBe('at your pace (last 90 days)')
		expect(forecastNote({ kind: 'grows' })).toBe('as many photos added as decided or more (last 90 days)')
	})
})
