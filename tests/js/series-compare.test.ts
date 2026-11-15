// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Series } from '../../src/logic/series.ts'
import type { Shot } from './series-compare-fixture.ts'

import { describe, expect, it } from 'vitest'
import { compareOf } from './series-compare-fixture.ts'

describe('useSeriesCompare', () => {
	// spec: SERIES-001.6, SERIES-001.7
	it('opens on the first series with its first picture active', () => {
		const { compare, shown } = compareOf(['A', 'B'], ['C', 'D', 'E'])
		compare.start()

		expect(compare.open.value).toBe(true)
		expect(shown()).toEqual(['A', 'B'])
		expect(compare.position.value).toBe(0)
		expect(compare.count.value).toBe(2)
		expect(compare.active.value).toBe(0)
	})

	// spec: SERIES-001.18
	it('holds new visual hashes back while it is open', () => {
		const { compare, held } = compareOf(['A', 'B'])
		compare.start()
		compare.close()

		expect(held).toEqual([true, false])
	})

	// spec: SERIES-001.11
	it('skips to the next series and after the last to the first', () => {
		const { compare, shown } = compareOf(['A', 'B'], ['C', 'D'])
		compare.start()
		compare.setActive(1)
		compare.skip()

		expect(shown()).toEqual(['C', 'D'])
		expect(compare.active.value).toBe(0)
		compare.skip()
		expect(shown()).toEqual(['A', 'B'])
	})

	// spec: SERIES-001.8
	it('decides one picture; a rejected one leaves the series, the next picture becomes active', () => {
		const { compare, calls, shown, shot } = compareOf(['A', 'B', 'C'], ['D', 'E'])
		compare.start()
		compare.decide({ kind: 'flag', flag: 'picked' }, shot('C'))
		compare.setActive(1)
		compare.decide({ kind: 'flag', flag: 'rejected' })

		expect(calls).toEqual(['picked C', 'rejected B'])
		expect(shown()).toEqual(['A', 'C'])
		expect(compare.active.value).toBe(1)
	})

	// spec: SERIES-001.8
	it('gives way to the next series once fewer than two pictures are left, and comes back on undo', () => {
		const { compare, shown, setFlag, shot } = compareOf(['A', 'B'], ['C', 'D'])
		compare.start()
		compare.setActive(1)
		compare.decide({ kind: 'flag', flag: 'rejected' }, shot('A'))

		expect(shown()).toEqual(['C', 'D'])
		expect(compare.count.value).toBe(1)
		expect(compare.active.value).toBe(0)
		setFlag(shot('A'), 'unflagged')
		expect(shown()).toEqual(['A', 'B'])
	})

	// spec: SERIES-001.8, SERIES-001.11
	it('keeps showing its series by key when a series before it comes back on undo, and by place once re-keyed', () => {
		const { compare, shown, setFlag, shot } = compareOf(['A', 'B'], ['C', 'D'], ['E', 'F', 'G'])
		compare.start()
		compare.pickRest(shot('A'))
		compare.skip()

		expect(shown()).toEqual(['E', 'F', 'G'])
		setFlag(shot('B'), 'unflagged')
		expect(shown()).toEqual(['E', 'F', 'G'])
		expect([compare.position.value, compare.count.value]).toEqual([2, 3])
		setFlag(shot('E'), 'rejected')
		expect(shown()).toEqual(['F', 'G'])
	})

	// spec: SERIES-001.9
	it('picks the active or the given picture and rejects the rest of its series', () => {
		const { compare, calls, shown, shot } = compareOf(['A', 'B', 'C'], ['D', 'E'])
		compare.start()
		compare.setActive(1)
		compare.pickRest()
		compare.pickRest(shot('E'))

		expect(calls).toEqual(['pick B, reject A C', 'pick E, reject D'])
		expect(shown()).toBeNull()
	})

	// spec: SERIES-001.10
	it('switches the active picture by the arrows within the series', () => {
		const { compare } = compareOf(['A', 'B', 'C'])
		compare.start()
		const keys = compare.hotkeys
		keys.previous!()
		expect(compare.active.value).toBe(0)
		keys.next!()
		keys.next!()
		keys.next!()
		expect(compare.active.value).toBe(2)
		keys.previous!()
		expect(compare.active.value).toBe(1)
	})

	// spec: SERIES-001.10
	it('moves the active picture a row up or down by the grid\'s columns', () => {
		const { compare } = compareOf(['A', 'B', 'C', 'D', 'E'])
		compare.start()
		const keys = compare.hotkeys
		keys.down!()
		expect(compare.active.value).toBe(1)
		compare.setColumns(3)
		keys.down!()
		expect(compare.active.value).toBe(4)
		keys.down!()
		expect(compare.active.value).toBe(4)
		keys.up!()
		expect(compare.active.value).toBe(1)
		keys.up!()
		expect(compare.active.value).toBe(1)
	})

	// spec: SERIES-001.10
	it('decides the active picture by a key, steps a rating from its own, and moves on with advance', () => {
		const { compare, calls } = compareOf(['A', 'B', 'C'])
		compare.start()
		const keys = compare.hotkeys
		keys.decide!({ kind: 'ratingStep', step: 1 }, false)
		keys.decide!({ kind: 'flag', flag: 'picked' }, true)
		keys.decide!({ kind: 'rating', rating: 4 }, true)
		keys['pick-rest']!()

		expect(calls).toEqual(['{"kind":"rating","rating":1} A', 'picked A', '{"kind":"rating","rating":4} B', 'pick C, reject A B'])
	})

	// spec: SERIES-001.12
	it('shows nothing once no series is left, and closes', () => {
		const { compare, shown } = compareOf()
		compare.start()

		expect(shown()).toBeNull()
		expect(compare.count.value).toBe(0)
		compare.hotkeys.decide!({ kind: 'flag', flag: 'picked' }, false)
		compare.hotkeys['pick-rest']!()
		compare.hotkeys.next!()
		compare.skip()
		compare.close()
		expect(compare.open.value).toBe(false)
	})

	// spec: SERIES-001.10
	it('closes by Escape', () => {
		const { compare } = compareOf(['A', 'B'])
		compare.start()
		compare.hotkeys.close!()

		expect(compare.open.value).toBe(false)
	})

	// spec: SERIES-002.1, SERIES-002.9
	it('opens the viewer on a picture of the shown series and makes the viewed one active on closing', () => {
		const { compare, shown } = compareOf(['A', 'B', 'C'], ['D', 'E'])
		compare.start()
		compare.view(1)

		expect(compare.viewer.open.value).toBe(true)
		expect(compare.viewer.index.value).toBe(1)
		compare.viewer.go(2)
		compare.viewer.close()
		expect(shown()).toEqual(['A', 'B', 'C'])
		expect(compare.active.value).toBe(2)
	})

	// spec: SERIES-002.7, SERIES-002.8
	it('closes the viewer by pick-rest and leaves the active picture once its series is gone', () => {
		const { compare, shown, shot } = compareOf(['A', 'B', 'C'], ['D', 'E'])
		compare.start()
		compare.view(2)
		compare.pickRest(shot('C'))

		expect(compare.viewer.open.value).toBe(false)
		expect(shown()).toEqual(['D', 'E'])
		expect(compare.active.value).toBe(0)
	})

	it('opens no viewer once no series is left', () => {
		const { compare } = compareOf()
		compare.start()
		compare.view(0)

		expect(compare.viewer.open.value).toBe(false)
	})

	// spec: SERIES-005.10
	it('removes the active or the given picture from the shown series and keeps showing the series', () => {
		const { compare, calls, shown, shot } = compareOf(['A', 'B', 'C', 'D'], ['E', 'F'])
		compare.start()
		compare.setActive(1)
		compare.removeFromSeries()
		compare.removeFromSeries(shot('D'))

		expect(calls).toEqual(['remove B from A B C D', 'remove D from A C D'])
		expect(shown()).toEqual(['A', 'C'])
	})

	// spec: SERIES-005.13
	it('dissolves the shown series and moves on as after Skip; undo brings it back', () => {
		const { compare, calls, shown, bringBack } = compareOf(['A', 'B'], ['C', 'D'])
		compare.start()
		compare.dissolve()

		expect(calls).toEqual(['dissolve A B'])
		expect(shown()).toEqual(['C', 'D'])
		bringBack()
		expect(shown()).toEqual(['A', 'B'])
	})

	// spec: SERIES-005.14
	it('marks the shown series done and moves on as after Skip; a done series is no longer offered', () => {
		const { compare, calls, shown } = compareOf(['A', 'B'], ['C', 'D'])
		compare.start()
		compare.markDone(true)

		expect(calls).toEqual(['done A B'])
		expect(shown()).toEqual(['C', 'D'])
		expect(compare.count.value).toBe(1)
	})

	/** The names of the shown series' neighbours. */
	const neighbourNames = ({ previous, next }: { previous: Series<Shot> | null, next: Series<Shot> | null }) => [previous, next].map((series) => series?.members.map(({ name }) => name) ?? null)

	// spec: SERIES-005.8
	it('offers the series before and after the shown one among every series, a decided one too', () => {
		const { compare, setFlag, shot } = compareOf(['A', 'B'], ['C', 'D'], ['E', 'F'])
		setFlag(shot('E'), 'picked')
		setFlag(shot('F'), 'picked')
		compare.start()

		expect(compare.count.value).toBe(2)
		expect(neighbourNames(compare.neighbours.value)).toEqual([null, ['C', 'D']])
		compare.skip()
		expect(neighbourNames(compare.neighbours.value)).toEqual([['A', 'B'], ['E', 'F']])
	})

	// spec: SERIES-005.8
	it('merges the shown series with the previous or next one and shows the merged series, the active picture still active', () => {
		const { compare, calls, shown } = compareOf(['A', 'B'], ['C', 'D'], ['E', 'F'])
		compare.start()
		compare.skip()
		compare.setActive(1)
		compare.merge('previous')

		expect(calls).toEqual(['merge A B + C D'])
		expect(shown()).toEqual(['A', 'B', 'C', 'D'])
		expect([compare.position.value, compare.count.value, compare.active.value]).toEqual([0, 2, 3])
		compare.merge('next')
		expect(calls.at(-1)).toBe('merge A B C D + E F')
		expect(shown()).toEqual(['A', 'B', 'C', 'D', 'E', 'F'])
		expect(compare.active.value).toBe(3)
	})

	// spec: SERIES-005.8
	it('merges nothing without a series that way or once no series is left', () => {
		const { compare, calls } = compareOf(['A', 'B'])
		compare.start()
		compare.merge('next')
		compare.merge('previous')
		const none = compareOf()
		none.compare.start()
		none.compare.merge('next')

		expect([...calls, ...none.calls]).toEqual([])
	})

	// spec: SERIES-005.10, SERIES-005.13
	it('edits nothing once no series is left', () => {
		const { compare, calls } = compareOf()
		compare.start()
		compare.removeFromSeries()
		compare.dissolve()

		expect(calls).toEqual([])
	})
})
