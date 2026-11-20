// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it } from 'vitest'
import { METRIC } from '../../../src/logic/statistics.ts'
import { hintYear, parseClosedYear, reviewYear, yearReview } from '../../../src/logic/year-review.ts'

describe('reviewYear', () => {
	// spec: STATS-001.25
	it('is the year that ends in December and the year that ended in January', () => {
		expect(reviewYear('2026-12-01')).toBe(2026)
		expect(reviewYear('2026-12-31')).toBe(2026)
		expect(reviewYear('2027-01-01')).toBe(2026)
		expect(reviewYear('2027-01-31')).toBe(2026)
	})

	// spec: STATS-001.25
	it('is none from 1 February to 30 November', () => {
		expect(reviewYear('2027-02-01')).toBeNull()
		expect(reviewYear('2026-11-30')).toBeNull()
		expect(reviewYear('2026-07-15')).toBeNull()
	})
})

describe('hintYear', () => {
	// spec: STATS-001.26
	it('shows for the review year until that year was closed', () => {
		expect(hintYear('2026-12-01', null)).toBe(2026)
		expect(hintYear('2026-12-01', 2025)).toBe(2026)
		expect(hintYear('2026-12-01', 2026)).toBeNull()
		expect(hintYear('2027-01-10', 2026)).toBeNull()
		expect(hintYear('2027-01-10', null)).toBe(2026)
	})

	// spec: STATS-001.26
	it('never shows outside December and January', () => {
		expect(hintYear('2026-06-01', null)).toBeNull()
	})
})

describe('parseClosedYear', () => {
	// spec: STATS-001.48
	it('reads a whole year and anything else as never closed', () => {
		expect(parseClosedYear({ yearReviewHintClosed: 2026 })).toBe(2026)
		expect(parseClosedYear({ yearReviewHintClosed: null })).toBeNull()
		expect(parseClosedYear({ yearReviewHintClosed: '2026' })).toBeNull()
		expect(parseClosedYear({ yearReviewHintClosed: 2026.5 })).toBeNull()
		expect(parseClosedYear({})).toBeNull()
		expect(parseClosedYear('2026')).toBeNull()
		expect(parseClosedYear(null)).toBeNull()
	})
})

const counter = (day: string, metric: string, value: number) => ({ day, metric, value })

describe('yearReview', () => {
	const counters = [
		counter('2025-12-31', METRIC.decided, 999),
		counter('2026-01-01', METRIC.decided, 30),
		counter('2026-01-02', METRIC.decided, 90),
		counter('2026-01-03', METRIC.decided, 90),
		counter('2026-01-03', METRIC.trashPictures, 40),
		counter('2026-01-03', METRIC.trashBytes, 4000),
		counter('2026-01-03', METRIC.deletedPictures, 2),
		counter('2026-01-03', METRIC.deletedBytes, 100),
		counter('2026-01-03', METRIC.rawsRemoved, 5),
		counter('2026-01-03', METRIC.rawsRemovedBytes, 700),
		counter('2026-01-03', METRIC.sidecarsCreated, 8),
		counter('2026-01-03', METRIC.sidecarsUpdated, 6),
		counter('2026-01-03', METRIC.sidecarsForeign, 3),
		counter('2026-01-03', METRIC.seriesDone, 4),
		counter('2026-01-03', METRIC.activeSeconds, 600),
		counter('2026-03-10', METRIC.trashPictures, 1),
		counter('2027-01-02', METRIC.decided, 5000),
	]
	const review = yearReview(counters, 2026, '2025-12-31')

	// spec: STATS-001.46
	it('sums only the days of the year', () => {
		expect(review).toMatchObject({
			year: 2026,
			decided: 210,
			trashed: 41,
			freedBytes: 4100,
			deletedForGood: 2,
			rawsRemoved: 5,
			rawsRemovedBytes: 700,
			sidecarsCreated: 8,
			sidecarsUpdated: 6,
			sidecarsForeign: 3,
			seriesDone: 4,
			activeMs: 600_000,
			perMinute: 21,
			longestStreak: 3,
		})
	})

	// spec: STATS-001.47
	it('names the busiest day, the earlier one on a tie', () => {
		expect(review.busiest).toEqual({ day: '2026-01-02', decided: 90 })
	})

	// spec: STATS-001.47
	it('has no busiest day while no picture was decided', () => {
		expect(yearReview([counter('2026-02-01', METRIC.trashPictures, 3)], 2026, '2026-02-01').busiest).toBeNull()
	})

	// spec: STATS-001.47
	it('has one square per day of the year, shaded by the share of the busiest day', () => {
		expect(review.calendar).toHaveLength(365)
		expect(review.calendar[0]).toEqual({ day: '2026-01-01', shade: 1 })
		expect(review.calendar[1]).toEqual({ day: '2026-01-02', shade: 3 })
		expect(review.calendar[364]).toEqual({ day: '2026-12-31', shade: 0 })
		expect(review.calendar.find((each) => each.day === '2026-03-10')).toEqual({ day: '2026-03-10', shade: 1 })
		expect(review.activeDays).toBe(4)
	})

	// spec: STATS-001.47
	it('shades by thirds of the busiest day and has a day more in a leap year', () => {
		const leap = yearReview([counter('2028-02-01', METRIC.decided, 90), counter('2028-02-02', METRIC.decided, 30), counter('2028-02-03', METRIC.decided, 31), counter('2028-02-04', METRIC.decided, 60), counter('2028-02-05', METRIC.decided, 61)], 2028, '2028-02-01')

		expect(leap.calendar).toHaveLength(366)
		expect(leap.calendar.slice(31, 36).map((each) => each.shade)).toEqual([3, 1, 2, 2, 3])
	})

	// spec: STATS-001.49
	it('says since when it counts only for a first day inside the year', () => {
		expect(review.countedSince).toBeNull()
		expect(yearReview(counters, 2026, '2026-01-01').countedSince).toBe('2026-01-01')
		expect(yearReview(counters, 2026, null).countedSince).toBeNull()
		expect(yearReview(counters, 2026, '2027-01-02').countedSince).toBeNull()
	})
})
