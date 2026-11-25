// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Series } from '../../../src/logic/series.ts'

import { describe, expect, it } from 'vitest'
import { rowBrackets, runsAt, seriesJump, seriesRuns, tileSeries } from '../../../src/logic/series-runs.ts'

const PICTURES = 'ABCDEFGHIJ'.split('')

/** Each named picture mapped to its series, one series per string of names. */
function seriesOf(...groups: string[]): Map<string, Series<string>> {
	return new Map(groups.flatMap((names, key) => {
		const series = { key, members: names.split('') }
		return series.members.map((name) => [name, series] as const)
	}))
}

const spans = (runs: ReturnType<typeof seriesRuns<string>>) => runs.map(({ first, end, series }) => `${first}-${end}:${series.key}`)

describe('seriesRuns', () => {
	// spec: SERIES-002.12
	it('makes one run of each stretch of neighbours in one series; a picture outside every series or another series ends it', () => {
		expect(spans(seriesRuns(PICTURES, seriesOf('BCD', 'EF', 'HI')))).toEqual(['1-4:0', '4-6:1', '7-9:2'])
	})

	// spec: SERIES-002.12
	it('splits a series whose members lie apart into a run each', () => {
		expect(spans(seriesRuns(PICTURES, seriesOf('ABEF')))).toEqual(['0-2:0', '4-6:0'])
	})

	// spec: SERIES-002.12
	it('ends a run where a folder group starts', () => {
		expect(spans(seriesRuns(PICTURES, seriesOf('BCDE'), [0, 3]))).toEqual(['1-3:0', '3-5:0'])
	})

	// spec: SERIES-002.12
	it('spans a rejected picture between two pictures of one series, but no rejected picture at either end', () => {
		const rejected = (picture: string) => 'ACDH'.includes(picture)
		expect(spans(seriesRuns(PICTURES, seriesOf('BEFG'), [], rejected))).toEqual(['1-7:0'])
	})

	// spec: SERIES-002.12
	it('ends a run at a rejected picture where a folder group starts or another series follows', () => {
		const rejected = (picture: string) => picture === 'C'
		expect(spans(seriesRuns(PICTURES, seriesOf('ABDE'), [2], rejected))).toEqual(['0-2:0', '3-5:0'])
		expect(spans(seriesRuns(PICTURES, seriesOf('AB', 'DE'), [], rejected))).toEqual(['0-2:0', '3-5:1'])
	})

	it('has no run without series', () => {
		expect(seriesRuns(PICTURES, new Map())).toEqual([])
	})
})

describe('rowBrackets', () => {
	const runs = seriesRuns(PICTURES, seriesOf('BCDE', 'GH'))
	const at = runsAt(runs, PICTURES.length)
	const parts = (first: number, count: number) => rowBrackets(at, first, count).map(({ from, to, run, starts, ends }) => `${from}-${to}:${run.series.key}${starts ? ' start' : ''}${ends ? ' end' : ''}`)

	// spec: SERIES-002.12
	it('draws the part of each run a row shows, with a cap where the run starts or ends', () => {
		expect(parts(0, 3)).toEqual(['1-3:0 start'])
		expect(parts(3, 3)).toEqual(['0-2:0 end'])
		expect(parts(6, 3)).toEqual(['0-2:1 start end'])
		expect(parts(9, 1)).toEqual([])
	})

	// spec: SERIES-002.12
	it('continues a run over a whole row without caps', () => {
		expect(rowBrackets(runsAt(seriesRuns(PICTURES, seriesOf('ABCDEFG')), PICTURES.length), 3, 3).map(({ from, to, starts, ends }) => [from, to, starts, ends])).toEqual([[0, 3, false, false]])
	})
})

describe('tileSeries', () => {
	const series = seriesOf('ABEF')
	const at = runsAt(seriesRuns(PICTURES, series), PICTURES.length)

	// spec: SERIES-002.10
	it('gives each tile its place in the series and the first of a run the run\'s length', () => {
		expect(tileSeries(at, 0, 'A')).toEqual({ series: series.get('A'), position: 1, size: 4, run: 2, stored: null })
		expect(tileSeries(at, 1, 'B')).toEqual({ series: series.get('A'), position: 2, size: 4, run: null, stored: null })
		expect(tileSeries(at, 4, 'E')).toEqual({ series: series.get('A'), position: 3, size: 4, run: 2, stored: null })
		expect(tileSeries(at, 2, 'C')).toBeNull()
	})

	// spec: SERIES-002.10
	it('gives a rejected tile inside a run no place and counts only the run\'s pictures of the series', () => {
		const spanned = runsAt(seriesRuns(PICTURES, series, [], (picture) => 'CD'.includes(picture)), PICTURES.length)

		expect(tileSeries(spanned, 0, 'A')).toEqual({ series: series.get('A'), position: 1, size: 4, run: 4, stored: null })
		expect(tileSeries(spanned, 2, 'C')).toBeNull()
		expect(tileSeries(spanned, 4, 'E')?.run).toBeNull()
	})

	// spec: SERIES-005.17
	it('says whether the tile\'s series is stored open, stored done or automatic', () => {
		const done = new Map([...'AB'].map((name) => [name, { key: 0, members: ['A', 'B'], stored: { id: 7, status: 'done', elsewhere: false } } as const]))

		expect(tileSeries(runsAt(seriesRuns(['A', 'B'], done), 2), 0, 'A')?.stored).toBe('done')
	})
})

describe('seriesJump', () => {
	const runs = seriesRuns(PICTURES, seriesOf('BCD', 'EF', 'HI'))
	const at = runsAt(runs, PICTURES.length)

	// spec: SERIES-002.15
	it('goes to the first photo of the next run', () => {
		expect([0, 1, 2, 4, 6].map((index) => seriesJump(runs, at, index, 'next'))).toEqual([1, 4, 4, 7, 7])
		expect(seriesJump(runs, at, 7, 'next')).toBeNull()
	})

	// spec: SERIES-002.15
	it('goes to the first photo of the run before the focused one\'s, past its own start', () => {
		expect([9, 8, 7, 6, 5, 4].map((index) => seriesJump(runs, at, index, 'previous'))).toEqual([7, 4, 4, 4, 1, 1])
		expect([0, 1, 3].map((index) => seriesJump(runs, at, index, 'previous'))).toEqual([null, null, null])
	})
})
