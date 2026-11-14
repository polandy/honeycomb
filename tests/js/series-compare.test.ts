// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
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
})
