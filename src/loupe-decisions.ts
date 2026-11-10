// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { DecisionIntent } from './logic/decision-change.ts'
import type { Decision } from './logic/decision.ts'
import type { HotkeyIntent } from './logic/hotkeys.ts'
import type { SwipeDirection } from './logic/loupe-gesture.ts'
import type { Picture } from './logic/pairing.ts'
import type { Toast } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed } from 'vue'
import { keyCap } from './hotkeys.ts'
import { commonDecision } from './logic/decision-change.ts'
import { isDecided, nextUndecided } from './logic/decision.ts'
import { stepRating } from './logic/hotkeys.ts'
import { swipeFlag } from './logic/loupe-gesture.ts'

/** What the loupe's decisions read from it and hand to it. */
export interface LoupeDecisionsContext<P extends Picture<{ readonly fileId: number }>> {
	readonly pictures: () => readonly P[]
	readonly index: () => number
	readonly decisionOf: (picture: P) => Decision
	/** Decides the picture, at once, as the cull does. */
	readonly decide: (intent: DecisionIntent, picture: P) => void
	readonly go: (index: number) => void
	readonly setFlagButtonsShown: (shown: boolean) => void
	readonly toast: (toast: Toast) => void
}

/** The shown picture's decision controls: a pick or reject moves on to the next undecided picture. */
export function useLoupeDecisions<P extends Picture<{ readonly fileId: number }>>(context: LoupeDecisionsContext<P>) {
	const shown = () => context.pictures()[context.index()]!
	const common = computed(() => commonDecision([{ picture: shown(), decision: context.decisionOf(shown()) }]))

	/** Decides the shown picture, then advances when it set a flag; returns whether it moved. */
	function decide(intent: DecisionIntent): boolean {
		const picture = shown()
		context.decide(intent, picture)
		const next = intent.kind === 'flag' && isDecided(context.decisionOf(picture)) ? nextUndecided(context.pictures(), context.index(), context.decisionOf) : null
		if (next !== null) {
			context.go(next)
		}
		return next !== null
	}

	/** Decides by a key: a star step counts from the shown rating, and `advance` goes on unless the decision moved. */
	function decideByKey(intent: HotkeyIntent, advance: boolean) {
		const index = context.index()
		const resolved = intent.kind === 'ratingStep' ? { kind: 'rating' as const, rating: stepRating(context.decisionOf(shown()).rating, intent.step) } : intent
		if (!decide(resolved) && advance) {
			context.go(index + 1)
		}
	}

	/** Sets the flag the swipe stands for, if any. */
	function swipe(direction: SwipeDirection) {
		const flag = swipeFlag(direction)
		if (flag !== null) {
			decide({ kind: 'flag', flag })
		}
	}

	/** Shows or hides the large flag buttons and says how to get them back, by the key when `byKey`. */
	function setFlagButtonsShown(flagButtonsShown: boolean, byKey = false) {
		context.setFlagButtonsShown(flagButtonsShown)
		context.toast(flagButtonsShown
			? { message: t('honeycomb', 'Flag buttons shown'), action: null }
			: {
					message: byKey
						? t('honeycomb', 'Flag buttons hidden · {key} shows them', { key: keyCap('flag-buttons') })
						: t('honeycomb', 'Flag buttons hidden · swipe to decide, the flag at the top shows them'),
					action: { label: t('honeycomb', 'Show'), run: () => setFlagButtonsShown(true) },
				})
	}

	return { common, decide, decideByKey, swipe, setFlagButtonsShown }
}
