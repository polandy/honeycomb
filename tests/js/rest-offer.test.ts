// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from '../../src/logic/decision.ts'
import type { CompareLanding } from '../../src/series-compare.ts'

import { computed, ref, shallowRef } from 'vue'
import { describe, expect, it } from 'vitest'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { useRestOffer } from '../../src/rest-offer.ts'

interface Shot { readonly name: string }

const PICK = { kind: 'flag', flag: 'picked' } as const

/** An offer over the series of named shots, the loupe showing `shownName`, with what it ran as text. */
function offerOf(series: string[], shownName: string | null = null) {
	const shots = new Map([...series, 'Z'].map((name) => [name, { name }]))
	const shot = (name: string) => shots.get(name)!
	const decisions = shallowRef(new Map<string, Decision>())
	const calls: string[] = []
	const open = ref(false)
	const current = shallowRef<readonly Shot[] | null>(null)
	const shown = shallowRef(shownName === null ? null : shot(shownName))
	const setFlag = (name: string, flag: Decision['flag']) => {
		decisions.value = new Map([...decisions.value, [name, { ...UNDECIDED, flag }]])
	}
	const members = series.map(shot)
	const offer = useRestOffer<Shot>({
		seriesOf: () => new Map(members.filter((member) => decisions.value.get(member.name)?.flag !== 'rejected').map((member, _, kept) => [member, kept])),
		decisionOf: (picture) => decisions.value.get(picture.name) ?? UNDECIDED,
		compare: {
			open,
			current: computed(() => current.value),
			pickRest: (picked) => calls.push(`compare pick ${picked!.name}`),
			pickRestAndLand: (rest, picked, land) => {
				calls.push(`pick ${picked.name}, reject ${rest.filter((member) => member !== picked).map((member) => member.name).join(' ')}`)
				land({ kind: 'after', series: rest, picked })
			},
		},
		shown: () => shown.value,
		land: (landing: CompareLanding<Shot>) => calls.push(`land after ${landing.kind === 'after' ? landing.picked.name : ''}`),
	})
	return { offer, shot, setFlag, calls, open, current, shown }
}

describe('useRestOffer', () => {
	// spec: LOUPE-002.16
	it('offers to reject the others of the picked picture\'s series and lands after it while the loupe shows a member', () => {
		const { offer, setFlag, shot, calls } = offerOf(['A', 'B', 'C'], 'B')
		setFlag('B', 'picked')

		const action = offer(PICK, shot('B'))!
		expect(action.label).toBe('Reject the other 2')
		action.run()
		expect(calls).toEqual(['pick B, reject A C', 'land after B'])
	})

	// spec: LOUPE-002.16
	it('counts the others it would reject, unflagged or picked, and stays where the loupe is once it shows no member', () => {
		const { offer, setFlag, shot, calls, shown } = offerOf(['A', 'B', 'C', 'D'], 'B')
		setFlag('A', 'rejected')
		setFlag('C', 'picked')
		setFlag('B', 'picked')

		const action = offer(PICK, shot('B'))!
		shown.value = shot('Z')
		action.run()
		expect(action.label).toBe('Reject the other 2')
		expect(calls).toEqual(['pick B, reject C D'])
	})

	// spec: LOUPE-002.16
	it('offers nothing for any other decision, a pick that unflagged, a picture outside a series or a series with no unflagged other', () => {
		const { offer, setFlag, shot } = offerOf(['A', 'B', 'C'])

		expect(offer({ kind: 'rating', rating: 3 }, shot('A'))).toBeNull()
		expect(offer(PICK, shot('A'))).toBeNull()
		setFlag('A', 'picked')
		expect(offer({ kind: 'flag', flag: 'rejected' }, shot('A'))).toBeNull()
		expect(offer(PICK, shot('Z'))).toBeNull()
		setFlag('B', 'picked')
		setFlag('C', 'rejected')
		expect(offer(PICK, shot('A'))).toBeNull()
	})

	// spec: SERIES-002.11
	it('runs the open compare\'s own pick-rest while it shows the picked picture\'s series', () => {
		const { offer, setFlag, shot, calls, open, current } = offerOf(['A', 'B', 'C'])
		setFlag('A', 'picked')
		open.value = true
		current.value = [shot('A'), shot('B'), shot('C')]

		offer(PICK, shot('A'))!.run()
		expect(calls).toEqual(['compare pick A'])
	})

	// spec: LOUPE-002.16
	it('does nothing once the series has gone since the offer', () => {
		const { offer, setFlag, shot, calls } = offerOf(['A', 'B'], 'A')
		setFlag('A', 'picked')

		const action = offer(PICK, shot('A'))!
		setFlag('B', 'rejected')
		setFlag('A', 'rejected')
		action.run()
		expect(calls).toEqual([])
	})
})
