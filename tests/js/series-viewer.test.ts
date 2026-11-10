// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../src/logic/decision.ts'

import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { useSeriesViewer } from '../../src/series-viewer.ts'

interface Shot { readonly name: string }

/** A viewer over named shots whose flags it keeps itself, noting what it hands back on closing. */
function viewerOf(...names: string[]) {
	const shots = names.map((name) => ({ name }))
	const decisions = shallowRef(new Map<Shot, Decision>())
	const closed: string[] = []
	const viewer = useSeriesViewer<Shot>({
		decisionOf: (shot) => decisions.value.get(shot) ?? UNDECIDED,
		closed: (shot) => closed.push(shot.name),
	})
	const setFlag = (name: string, flag: Decision['flag']) => {
		decisions.value = new Map([...decisions.value, [shots.find((shot) => shot.name === name)!, { ...UNDECIDED, flag }]])
	}
	const shown = () => viewer.pictures.value.map((shot) => shot.name)
	const current = () => viewer.pictures.value[viewer.index.value]?.name
	return { viewer, shots, setFlag, shown, current, closed }
}

describe('useSeriesViewer', () => {
	// spec: SERIES-002.1
	it('opens on the given picture of the series', () => {
		const { viewer, shots, shown, current } = viewerOf('A', 'B', 'C')
		expect(viewer.open.value).toBe(false)
		viewer.openAt(shots, 1)

		expect(viewer.open.value).toBe(true)
		expect(shown()).toEqual(['A', 'B', 'C'])
		expect(current()).toBe('B')
		expect(viewer.index.value).toBe(1)
	})

	// spec: SERIES-002.2
	it('pages within the series and not beyond its ends', () => {
		const { viewer, shots, current } = viewerOf('A', 'B', 'C')
		viewer.openAt(shots, 0)
		viewer.go(-1)
		expect(current()).toBe('A')
		viewer.go(2)
		expect(current()).toBe('C')
		viewer.go(3)
		expect(current()).toBe('C')
	})

	// spec: SERIES-002.6
	it('moves to the next picture when the shown one is rejected, the previous after the last', () => {
		const { viewer, shots, setFlag, shown, current } = viewerOf('A', 'B', 'C', 'D')
		viewer.openAt(shots, 1)
		setFlag('B', 'rejected')
		expect(shown()).toEqual(['A', 'C', 'D'])
		expect(current()).toBe('C')

		viewer.go(2)
		setFlag('D', 'rejected')
		expect(current()).toBe('C')
	})

	// spec: SERIES-002.6
	it('shows a picture an undo brings back, and keeps the shown one when another leaves', () => {
		const { viewer, shots, setFlag, shown, current } = viewerOf('A', 'B', 'C')
		viewer.openAt(shots, 2)
		setFlag('A', 'rejected')
		expect(current()).toBe('C')

		setFlag('A', 'unflagged')
		expect(shown()).toEqual(['A', 'B', 'C'])
		expect(current()).toBe('A')
		setFlag('B', 'picked')
		expect(current()).toBe('A')
	})

	// spec: SERIES-002.8
	it('closes once fewer than two pictures are left, handing back the shown one', () => {
		const { viewer, shots, setFlag, closed } = viewerOf('A', 'B')
		viewer.openAt(shots, 0)
		setFlag('A', 'rejected')

		expect(viewer.open.value).toBe(false)
		expect(closed).toEqual(['B'])
		setFlag('A', 'unflagged')
		expect(viewer.open.value).toBe(false)
	})

	// spec: SERIES-002.9
	it('closes with the shown picture, once, and ignores paging while closed', () => {
		const { viewer, shots, closed } = viewerOf('A', 'B', 'C')
		viewer.openAt(shots, 0)
		viewer.go(1)
		viewer.close()
		viewer.close()
		viewer.go(0)

		expect(closed).toEqual(['B'])
		expect(viewer.open.value).toBe(false)
		expect(viewer.pictures.value).toEqual([])
		expect(viewer.index.value).toBe(0)
	})

	// spec: SERIES-002.1
	it('opens on the first picture when the given one is not in the series', () => {
		const { viewer, shots, current } = viewerOf('A', 'B')
		viewer.openAt(shots, 5)

		expect(current()).toBe('A')
	})
})
