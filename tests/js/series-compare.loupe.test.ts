// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CompareLanding } from '../../src/series-compare.ts'
import type { Shot } from './series-compare-fixture.ts'

import { describe, expect, it } from 'vitest'
import { compareOf } from './series-compare-fixture.ts'

/** A compare opened from the loupe on the series of `names`, `active` active, with the landings it hands back as text. */
function fromLoupe(names: string[], active: string, ...grid: string[][]) {
	const fixture = compareOf(...grid, names)
	const landings: string[] = []
	const land = (landing: CompareLanding<Shot>) => landings.push(landing.kind === 'on'
		? `on ${landing.picture.name}`
		: `after ${landing.series.map((shot) => shot.name).join(' ')}, picked ${landing.picked.name}`)
	fixture.compare.startOn(names.map(fixture.shot), fixture.shot(active), land)
	return { ...fixture, landings }
}

describe('useSeriesCompare: opened from the loupe', () => {
	// spec: SERIES-001.24
	it('holds the one series alone with the loupe\'s picture active, decided or not', () => {
		const { compare, shown, held, setFlag, shot } = fromLoupe(['C', 'D', 'E'], 'D', ['A', 'B'])
		setFlag(shot('C'), 'picked')

		expect(compare.open.value).toBe(true)
		expect(compare.oneSeries.value).toBe(true)
		expect(shown()).toEqual(['C', 'D', 'E'])
		expect(compare.active.value).toBe(1)
		expect([compare.position.value, compare.count.value]).toEqual([0, 1])
		expect(held).toEqual([true])
	})

	// spec: SERIES-001.24
	it('returns to the loupe on the active picture when it closes', () => {
		const { compare, landings, held } = fromLoupe(['C', 'D', 'E'], 'D')
		compare.hotkeys.next!()
		compare.hotkeys.close!()

		expect(compare.open.value).toBe(false)
		expect(landings).toEqual(['on E'])
		expect(held).toEqual([true, false])
	})

	// spec: SERIES-001.24
	it('closes on pick-rest and lands after the series it showed', () => {
		const { compare, landings, calls } = fromLoupe(['C', 'D', 'E'], 'D')
		compare.pickRest()

		expect(calls).toEqual(['pick D, reject C E'])
		expect(compare.open.value).toBe(false)
		expect(landings).toEqual(['after C D E, picked D'])
	})

	// spec: SERIES-001.24
	it('lands after the series on pick-rest in its series viewer, the viewer closed too', () => {
		const { compare, landings, shot } = fromLoupe(['C', 'D', 'E'], 'C')
		compare.view(2)
		compare.pickRest(shot('E'))

		expect(compare.viewer.open.value).toBe(false)
		expect(compare.open.value).toBe(false)
		expect(landings).toEqual(['after C D E, picked E'])
	})

	// spec: SERIES-001.24
	it('closes where the loupe was once fewer than two of its pictures are left', () => {
		const { compare, landings } = fromLoupe(['C', 'D'], 'C')
		compare.decide({ kind: 'flag', flag: 'rejected' })

		expect(compare.open.value).toBe(false)
		expect(landings).toEqual([])
	})

	// spec: SERIES-001.6
	it('opens on every series again from the grid, landing nowhere', () => {
		const { compare, shown, landings } = fromLoupe(['C', 'D'], 'C', ['A', 'B'])
		compare.close()
		compare.start()

		expect(compare.oneSeries.value).toBe(false)
		expect(shown()).toEqual(['A', 'B'])
		expect(compare.count.value).toBe(2)
		compare.close()
		expect(landings).toEqual(['on C'])
	})
})
