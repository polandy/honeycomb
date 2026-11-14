// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from '../../src/logic/decision-change.ts'
import type { Decision } from '../../src/logic/decision.ts'

import { shallowRef } from 'vue'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { useSeriesCompare } from '../../src/series-compare.ts'

export interface Shot { readonly name: string }

/** A compare over the series of named shots whose decisions it keeps itself. */
export function compareOf(...series: string[][]) {
	const shots = new Map(series.flat().map((name) => [name, { name }]))
	const decisions = shallowRef(new Map<string, Decision>())
	const calls: string[] = []
	const held: boolean[] = []
	const decisionOf = (shot: Shot) => decisions.value.get(shot.name) ?? UNDECIDED
	const setFlag = (shot: Shot, flag: Decision['flag']) => {
		decisions.value = new Map([...decisions.value, [shot.name, { ...decisionOf(shot), flag }]])
	}
	const compare = useSeriesCompare<Shot>({
		series: () => series.map((names) => names.map((name) => shots.get(name)!)),
		decisionOf,
		decide: (intent: DecisionIntent, shot) => {
			calls.push(`${intent.kind === 'flag' ? intent.flag : JSON.stringify(intent)} ${shot.name}`)
			if (intent.kind === 'flag') {
				setFlag(shot, intent.flag)
			}
		},
		pickRest: (picked, rest) => {
			calls.push(`pick ${picked.name}, reject ${rest.map((shot) => shot.name).join(' ')}`)
			setFlag(picked, 'picked')
			rest.forEach((shot) => setFlag(shot, 'rejected'))
		},
		settings: () => DEFAULT_SETTINGS,
		updateSettings: () => undefined,
		toast: () => undefined,
		holdHashes: (hold) => held.push(hold),
	})
	const shown = () => compare.current.value?.map((shot) => shot.name) ?? null
	return { compare, calls, held, shown, setFlag, shot: (name: string) => shots.get(name)! }
}
