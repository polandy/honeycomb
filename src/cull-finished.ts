// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { CullSession, SessionNumbers, SessionState } from './logic/cull-session.ts'
import type { Decision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SavedSidecar } from './logic/sidecar-sync.ts'
import type { TrashExpectation, TrashReport } from './logic/trash-report.ts'

import { onBeforeUnmount, onMounted, shallowRef, watch } from 'vue'
import { ACTIVE_INPUTS } from './active-time.ts'
import { finishesCull, sessionNumbers, sessionState, startSession, totalsOf, withDeleted, withInput, withSaved, withStep } from './logic/cull-session.ts'
import { positionFileId } from './logic/resume-position.ts'

/** What *Cull finished* reads from the cull. */
export interface CullFinishedContext {
	readonly folderSet: () => FolderSet | null
	readonly pictures: () => readonly Picture<ListingEntry>[]
	readonly decisionOf: (picture: Picture<ListingEntry>) => Decision
	readonly decidedOf: (picture: Picture<ListingEntry>) => boolean
	/** A monotonic clock in ms. */
	readonly now: () => number
}

/** The *Cull finished* card: the session's numbers, opened once the user decides the last picture or a review delete ends (STATS-001). */
export function useCullFinished(context: CullFinishedContext) {
	const numbers = shallowRef<SessionNumbers | null>(null)
	let session: CullSession | null = null
	let pending = false
	let blocked = () => false

	/** The folder set's session, started with its pictures the first time it has some. */
	function current(): CullSession | null {
		const pictures = context.pictures()
		if (session === null && pictures.length > 0) {
			session = startSession(totalsOf(pictures))
		}
		return session
	}

	/** Each picture's state now, by picture key. */
	function states(): Map<number, SessionState> {
		return new Map(context.pictures().map((picture) => [positionFileId(picture), sessionState(context.decisionOf(picture).flag, context.decidedOf(picture))]))
	}

	/** Each function of `steps` recording what it changed, and opening the card when it took the last undecided picture. */
	function watching<T extends Record<string, (...args: never[]) => unknown>>(steps: T): T {
		return Object.fromEntries(Object.entries(steps).map(([name, step]) => [name, (...args: never[]) => {
			const before = states()
			const result = step(...args)
			const after = states()
			const started = current()
			if (started !== null) {
				session = withStep(started, before, after)
				pending ||= finishesCull(before, after)
				show()
			}
			return result
		}])) as T
	}

	/** Counts a delete's pictures, *Remove RAWs* left out; a delete from the reject review opens the card. */
	function deleted(report: TrashReport, expect: TrashExpectation | null) {
		const started = current()
		if (started === null || expect === 'rawRemovable') {
			return
		}
		const files = [...report.trashed.map((file) => ({ file, permanent: false })), ...report.deleted.map((file) => ({ file, permanent: true }))]
		session = withDeleted(started, files.map(({ file, permanent }) => ({ picture: positionFileId(file.picture), bytes: file.entry.size, permanent })))
		pending ||= expect === 'rejected'
		show()
	}

	/** Counts the sidecars a save wrote. */
	function saved(sidecars: readonly SavedSidecar[]) {
		const started = current()
		session = started === null ? null : withSaved(started, sidecars)
	}

	/** Counts an input towards active time. */
	function input() {
		const started = current()
		session = started === null ? null : withInput(started, context.now())
	}

	/** Opens the card when it waits and nothing it waits for is open. */
	function show() {
		if (pending && session !== null && !blocked()) {
			pending = false
			numbers.value = sessionNumbers(session, totalsOf(context.pictures()), context.now())
		}
	}

	/** Holds the card while `screens` says a screen it waits for is open: the loupe, the series compare or a delete dialog. */
	function waitWhile(screens: () => boolean) {
		blocked = screens
	}

	/** Closes the card. */
	function close() {
		numbers.value = null
	}

	watch(context.folderSet, () => {
		session = null
		pending = false
		numbers.value = null
	}, { flush: 'sync' })
	watch(context.pictures, current)
	onMounted(() => {
		watch(blocked, show)
		ACTIVE_INPUTS.forEach((type) => window.addEventListener(type, input, { capture: true, passive: true }))
	})
	onBeforeUnmount(() => ACTIVE_INPUTS.forEach((type) => window.removeEventListener(type, input, { capture: true })))

	return { numbers, watching, deleted, saved, waitWhile, close }
}
