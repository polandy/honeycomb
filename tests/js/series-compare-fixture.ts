// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from '../../src/logic/decision-change.ts'
import type { Decision } from '../../src/logic/decision.ts'
import type { Series } from '../../src/logic/series.ts'

import { shallowRef } from 'vue'
import { UNDECIDED } from '../../src/logic/decision.ts'
import { findSeries } from '../../src/logic/series.ts'
import { DEFAULT_SETTINGS } from '../../src/logic/settings.ts'
import { useSeriesCompare } from '../../src/series-compare.ts'

export interface Shot { readonly name: string }

/** A compare over the series of named shots whose decisions and series edits it keeps itself. */
export function compareOf(...series: string[][]) {
	const shots = new Map(series.flat().map((name) => [name, { name }]))
	const groups = shallowRef(series)
	const decisions = shallowRef(new Map<string, Decision>())
	const out = shallowRef<ReadonlySet<string>>(new Set())
	const calls: string[] = []
	/** The series of the named shots, keyed by the place of its first shot among all, as a rejected first shot re-keys it. */
	const seriesOf = (names: readonly string[]) => ({ key: [...shots.keys()].indexOf(names[0]!), members: names.map((name) => shots.get(name)!) })
	const held: boolean[] = []
	const decisionOf = (shot: Shot) => decisions.value.get(shot.name) ?? UNDECIDED
	const setFlag = (shot: Shot, flag: Decision['flag']) => {
		decisions.value = new Map([...decisions.value, [shot.name, { ...decisionOf(shot), flag }]])
	}
	const keepOut = (shots: readonly Shot[]) => {
		out.value = new Set([...out.value, ...shots.map((shot) => shot.name)])
	}
	/** Joins the groups of the merged series into the first one's place. */
	const merge = (merged: readonly Series<Shot>[]) => {
		const names = merged.flatMap(({ members }) => members.map(({ name }) => name))
		const touched = (group: readonly string[]) => group.some((name) => names.includes(name))
		const first = groups.value.find(touched)
		groups.value = groups.value.flatMap((group) => (group === first ? [groups.value.filter(touched).flat()] : touched(group) ? [] : [group]))
	}
	const everySeries = () => groups.value.map((names) => seriesOf(names.filter((name) => decisionOf(shots.get(name)!).flag !== 'rejected' && !out.value.has(name))))
	const compare = useSeriesCompare<Shot>({
		series: () => findSeries(everySeries(), decisionOf),
		everySeries,
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
		removeFromSeries: (shown, shot) => {
			calls.push(`remove ${shot.name} from ${shown.members.map(({ name }) => name).join(' ')}`)
			keepOut([shot])
		},
		dissolve: (shown) => {
			calls.push(`dissolve ${shown.members.map(({ name }) => name).join(' ')}`)
			keepOut(shown.members)
		},
		merge: (merged) => {
			calls.push(`merge ${merged.map(({ members }) => members.map(({ name }) => name).join(' ')).join(' + ')}`)
			merge(merged)
		},
		settings: () => DEFAULT_SETTINGS,
		updateSettings: () => undefined,
		toast: () => undefined,
		holdHashes: (hold) => held.push(hold),
	})
	const shown = () => compare.current.value?.members.map((shot) => shot.name) ?? null
	const bringBack = () => {
		out.value = new Set()
	}
	return { compare, calls, held, shown, setFlag, bringBack, shot: (name: string) => shots.get(name)!, seriesOf }
}
