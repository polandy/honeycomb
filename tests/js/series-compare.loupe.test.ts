// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CompareLanding } from '../../src/series/series-compare.ts'
import type { Shot } from './series-compare-fixture.ts'

import { describe, expect, it } from 'vitest'
import { compareOf } from './series-compare-fixture.ts'

/** A compare opened from the loupe on the series of `names`, `active` active, with the landings it hands back as text. */
function fromLoupe(names: string[], active: string, ...grid: string[][]) {
	const fixture = compareOf(...grid, names)
	const landings: string[] = []
	const land = (landing: CompareLanding<Shot>) => landings.push(landing.kind === 'on'
		? `on ${landing.picture.name}`
		: `after ${landing.series.members.map((shot) => shot.name).join(' ')}, picked ${landing.picked.name}`)
	fixture.compare.startOn(fixture.seriesOf(names), fixture.shot(active), land, 'loupe')
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

	// spec: LOUPE-002.15
	it('picks for the loupe without opening and lands after the series', () => {
		const { compare, calls, shot, seriesOf } = compareOf(['C', 'D', 'E'])
		const landings: string[] = []
		compare.pickRestAndLand(seriesOf(['C', 'D', 'E']), shot('E'), (landing) => landings.push(landing.kind === 'after' ? `after ${landing.series.key}: ${landing.series.members.map(({ name }) => name).join(' ')}, picked ${landing.picked.name}` : 'on'))

		expect(calls).toEqual(['pick E, reject C D'])
		expect(compare.open.value).toBe(false)
		expect(landings).toEqual([`after ${seriesOf(['C', 'D', 'E']).key}: C D E, picked E`])
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

	// spec: SERIES-005.10
	it('removes a picture from the one series it holds and closes once one picture is left', () => {
		const { compare, calls, shown, shot, landings } = fromLoupe(['C', 'D', 'E'], 'D')
		compare.removeFromSeries()

		expect(calls).toEqual(['remove D from C D E'])
		expect(shown()).toEqual(['C', 'E'])
		compare.removeFromSeries(shot('C'))
		expect(compare.open.value).toBe(false)
		expect(landings).toEqual([])
	})

	// spec: SERIES-005.13
	it('closes on dissolving its series and lands on the active picture', () => {
		const { compare, calls, landings } = fromLoupe(['C', 'D', 'E'], 'E')
		compare.dissolve()

		expect(calls).toEqual(['dissolve C D E'])
		expect(compare.open.value).toBe(false)
		expect(landings).toEqual(['on E'])
	})

	// spec: SERIES-005.8
	it('merges its one series with the series before it and holds the merged series', () => {
		const { compare, calls, shown } = fromLoupe(['C', 'D'], 'D', ['A', 'B'])

		expect(compare.neighbours.value.next).toBeNull()
		compare.merge('previous')
		expect(calls).toEqual(['merge A B + C D'])
		expect(shown()).toEqual(['A', 'B', 'C', 'D'])
		expect([compare.oneSeries.value, compare.count.value, compare.active.value]).toEqual([true, 1, 3])
	})

	// spec: SERIES-005.14, SERIES-005.15
	it('marks its one series done and keeps showing it, then reopens it', () => {
		const { compare, calls, shown } = fromLoupe(['C', 'D'], 'D', ['A', 'B'])
		compare.markDone(true)

		expect(shown()).toEqual(['C', 'D'])
		expect(compare.current.value?.stored?.status).toBe('done')
		compare.markDone(false)
		expect(calls).toEqual(['done C D', 'reopen C D'])
		expect(compare.current.value?.stored).toBeUndefined()
		expect(compare.active.value).toBe(1)
	})
})
