// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { CompareLanding, SeriesCompareFlow } from './series-compare.ts'
import type { ToastAction } from './toast.ts'

import { n } from '@nextcloud/l10n'
import { formatNumber, PLAIN_TEXT } from './l10n.ts'

/** What the undo toast's *Reject the other N* reads and runs through. */
export interface RestOfferContext<P extends object> {
	readonly seriesOf: () => ReadonlyMap<P, readonly P[]>
	readonly decisionOf: (picture: P) => Decision
	readonly compare: Pick<SeriesCompareFlow<P>, 'open' | 'current' | 'pickRest' | 'pickRestAndLand'>
	/** The picture the loupe shows, null while it is closed. */
	readonly shown: () => P | null
	readonly land: (landing: CompareLanding<P>) => void
}

/** The toast's offer after a plain *Pick* to reject the other pictures of its series, or null (LOUPE-002.16, SERIES-002.11). */
export function useRestOffer<P extends object>(context: RestOfferContext<P>) {
	/** The others of the picture's series, which *Pick this, reject the rest* would reject. */
	const othersOf = (picked: P) => (context.seriesOf().get(picked) ?? []).filter((picture) => picture !== picked)

	/** Picks the picture and rejects the rest of its series as one step, by the open compare's own step while it shows that series. */
	function rejectOthers(picked: P) {
		const series = context.seriesOf().get(picked)
		if (series === undefined || series.length < 2) {
			return
		}
		const { compare } = context
		if (compare.open.value && compare.current.value?.includes(picked)) {
			compare.pickRest(picked)
			return
		}
		const shown = context.shown()
		const showsMember = shown !== null && series.includes(shown)
		compare.pickRestAndLand(series, picked, (landing) => {
			if (showsMember) {
				context.land(landing)
			}
		})
	}

	return (intent: DecisionIntent, picked: P): ToastAction | null => {
		const others = othersOf(picked)
		const picks = intent.kind === 'flag' && intent.flag === 'picked' && context.decisionOf(picked).flag === 'picked'
		if (!picks || !others.some((picture) => context.decisionOf(picture).flag === 'unflagged')) {
			return null
		}
		return {
			label: n('honeycomb', 'Reject the other {count}', 'Reject the other {count}', others.length, { count: formatNumber(others.length) }, PLAIN_TEXT),
			run: () => rejectOthers(picked),
		}
	}
}
