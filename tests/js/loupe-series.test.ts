// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import { describe, expect, it, vi } from 'vitest'
import { SHARPNESS_METHOD } from '../../src/logic/sharpness.ts'
import { useLoupeSeries } from '../../src/loupe-series.ts'

type Shown = Parameters<Parameters<typeof useLoupeSeries>[0]['compare']>[1]

const photo = (name: string) => ({ baseName: name }) as unknown as Shown
const [a, b, c] = [photo('a'), photo('b'), photo('c')] as [Shown, Shown, Shown]
const series = { members: [a, b] } as unknown as Parameters<Parameters<typeof useLoupeSeries>[0]['compare']>[0]

function setup(shown: Shown, sharpness: Record<string, number> = {}) {
	const targets = { dismissHint: vi.fn(), compare: vi.fn(), pickRest: vi.fn() }
	const loupe = useLoupeSeries({
		pictures: () => [a, b, c],
		picture: () => shown,
		seriesOf: () => new Map([[a, series], [b, series]]),
		qualityOf: (picture) => (picture.baseName in sharpness ? { method: SHARPNESS_METHOD, sharpness: sharpness[picture.baseName]!, focusTile: 0 } : null),
		...targets,
	})
	return { loupe, ...targets }
}

describe('useLoupeSeries', () => {
	it('places the shown picture within its series', () => {
		expect(setup(b).loupe.place.value).toEqual({ position: 2, count: 2 })
		expect(setup(c).loupe.place.value).toBeNull()
	})

	// spec: SERIES-007.4, SERIES-007.5
	it('ranks the shown picture within its series and knows the sharpest of each series', () => {
		const measured = { a: 100, b: 300 }
		expect(setup(a, measured).loupe.sharpness.value).toEqual({ rank: 2, count: 2, sharpest: false })
		expect([...setup(c, measured).loupe.sharpest.value]).toEqual([b])
		expect(setup(c, measured).loupe.sharpness.value).toBeNull()
		expect(setup(b, { b: 300 }).loupe.sharpness.value).toBeNull()
		expect(setup(b, { b: 300 }).loupe.sharpest.value.size).toBe(0)
	})

	it('compares with the shown picture active while it is in the series', () => {
		const { loupe, compare, dismissHint } = setup(b)
		loupe.compareAt(0)
		expect(dismissHint).toHaveBeenCalledOnce()
		expect(compare).toHaveBeenCalledWith(series, b)
	})

	it('compares with the picture asked for when the shown one is outside the series', () => {
		const { loupe, compare } = setup(c)
		loupe.compareAt(1)
		expect(compare).toHaveBeenCalledWith(series, b)
	})

	it('ignores a compare of a picture without a series', () => {
		const { loupe, compare, dismissHint } = setup(a)
		loupe.compareAt(2)
		expect(compare).not.toHaveBeenCalled()
		expect(dismissHint).not.toHaveBeenCalled()
	})

	it('picks the rest only inside a series', () => {
		const inside = setup(a)
		inside.loupe.pickRest()
		expect(inside.pickRest).toHaveBeenCalledWith(series, a)
		const outside = setup(c)
		outside.loupe.pickRest()
		expect(outside.pickRest).not.toHaveBeenCalled()
	})
})
