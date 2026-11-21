// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './decision.ts'
import type { Series } from './series.ts'

import { isPicked } from './decision.ts'
import { findSeries } from './series.ts'
import { sharpestMember } from './sharpness.ts'

/** A series the reduction decides: its sharpest member picked, the others rejected (SERIES-008). */
export interface ReducedSeries<P> {
	readonly key: number
	readonly kept: P
	readonly rejected: readonly P[]
}

/** The series the reduction decides and how many series it leaves for the user to compare. */
export interface ReductionPlan<P> {
	readonly reduced: readonly ReducedSeries<P>[]
	readonly leftOut: number
}

/** What the plan reads of each picture. */
export interface ReductionInputs<P> {
	readonly sharpnessOf: (picture: P) => number | null
	readonly decisionOf: (picture: P) => Decision
	/** Whether a decision on the picture is written through, not held by a locked sidecar. */
	readonly writable: (picture: P) => boolean
}

/** The plan over the series the compare offers: each with a sharpest, no other picked member and no locked one is reduced (SERIES-008.1). */
export function reductionPlan<P>(series: readonly Series<P>[], inputs: ReductionInputs<P>): ReductionPlan<P> {
	const open = findSeries(series, inputs.decisionOf)
	const reduced = open.flatMap(({ key, members }): ReducedSeries<P>[] => {
		const kept = sharpestMember(members, inputs.sharpnessOf)
		const rejected = members.filter((picture) => picture !== kept)
		const reducible = kept !== null && members.every(inputs.writable) && !rejected.some((picture) => isPicked(inputs.decisionOf(picture)))
		return reducible ? [{ key, kept, rejected }] : []
	})
	return { reduced, leftOut: open.length - reduced.length }
}

/** The plan with the series of the key left out (SERIES-008.4). */
export function withoutSeries<P>(plan: ReductionPlan<P>, key: number): ReductionPlan<P> {
	const reduced = plan.reduced.filter((series) => series.key !== key)
	return { reduced, leftOut: plan.leftOut + plan.reduced.length - reduced.length }
}

/** How many series the plan reduces, how many photos it picks and rejects, and how many series it leaves out. */
export function reductionCounts<P>(plan: ReductionPlan<P>) {
	const rejected = plan.reduced.reduce((sum, series) => sum + series.rejected.length, 0)
	return { series: plan.reduced.length, picked: plan.reduced.length, rejected, leftOut: plan.leftOut }
}
