// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from '../logic/listing.ts'
import type { PairingSettings } from '../logic/pairing.ts'
import type { QualityApi } from './quality-values.ts'

import { computed, ref, shallowRef, watch } from 'vue'
import { imageMember } from '../logic/image-tiers.ts'
import { pairPictures } from '../logic/pairing.ts'
import { seriesCandidates } from '../logic/series.ts'
import { fireAndLog } from '../shared/fire-and-log.ts'
import { logger } from '../shared/logger.ts'
import { useQualityValues } from './quality-values.ts'
import { currentHash } from './visual-hashes.ts'

/** What the similarity page's sharpness pass needs: the tree's listing, the user's pairing settings and the cull's quality values (SERIES-004.17). */
export interface SharpnessRunSeams extends QualityApi {
	/** The entries of a folder and every folder below it (LISTING-001). */
	readonly listTree: (path: string) => Promise<readonly ListingEntry[]>
	readonly pairing: () => Promise<PairingSettings>
}

/** Where a pass stands; `paused` also after a failed listing. */
export type SharpnessRunStatus = 'idle' | 'running' | 'paused' | 'done'

/** The shown members of the series candidates among a tree's entries, linked by capture time and the listed hashes, decided or not (SERIES-001). */
function candidateMembers(entries: readonly ListingEntry[], settings: PairingSettings): ListingEntry[] {
	const pictures = pairPictures(entries, settings)
	return seriesCandidates(pictures, (picture) => currentHash(imageMember(picture))).flat().map(imageMember)
}

/**
 * A pass that lists a folder tree, links its series candidates and measures the sharpness of their members without a
 * current value, as the cull measures them; it pauses and resumes, and a failed listing pauses it (SERIES-004.17–.21).
 */
export function useSharpnessRun(seams: SharpnessRunSeams) {
	const status = ref<SharpnessRunStatus>('idle')
	const problem = ref(false)
	const members = shallowRef<readonly ListingEntry[]>([])
	const quality = useQualityValues(seams, () => members.value, () => status.value === 'running')
	let run = 0
	let folder = ''
	let listed = false
	let listing = false

	const progress = computed(() => {
		const states = members.value.map(quality.stateOf)
		return { total: states.length, measured: states.filter((state) => state === 'done').length, failed: states.filter((state) => state === 'failed').length }
	})

	/** Turns a running pass `done` once the tree is listed and no member is left. */
	function settle() {
		const { total, measured, failed } = progress.value
		if (status.value === 'running' && listed && measured + failed === total) {
			status.value = 'done'
		}
	}
	watch(progress, settle)

	/** Lists the tree and keeps the members still to measure; a failure pauses the pass. */
	async function list(of: number) {
		listing = true
		try {
			const [entries, settings] = await Promise.all([seams.listTree(folder), seams.pairing()])
			if (of === run) {
				members.value = candidateMembers(entries, settings).filter((member) => quality.stateOf(member) === 'pending')
				listed = true
			}
		} catch (error) {
			logger.warn('Could not list the series to measure', { error })
			if (of === run) {
				problem.value = true
				status.value = 'paused'
			}
		} finally {
			if (of === run) {
				listing = false
				settle()
			}
		}
	}

	/** Lists the tree below `path` afresh and measures its series members. */
	function start(path: string) {
		run++
		folder = path
		members.value = []
		listed = false
		listing = false
		problem.value = false
		status.value = 'running'
		fireAndLog(list(run), 'Could not list the series to measure')
	}

	/** Measures no further photo; the one in work finishes. */
	function pause() {
		if (status.value === 'running') {
			status.value = 'paused'
		}
	}

	/** Goes on where the pass paused, and lists the tree again after a failed listing. */
	function resume() {
		if (status.value !== 'paused') {
			return
		}
		problem.value = false
		status.value = 'running'
		if (!listed && !listing) {
			fireAndLog(list(run), 'Could not list the series to measure')
		}
		settle()
	}

	return { status, problem, progress, start, pause, resume }
}
