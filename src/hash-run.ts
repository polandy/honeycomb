// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { HashState } from './logic/hash-progress.ts'
import type { StoredVisualHash } from './logic/visual-hash.ts'

import { computed, ref, shallowRef, triggerRef } from 'vue'
import { logger } from './logger.ts'
import { hashProgress } from './logic/hash-progress.ts'

/** How many computed hashes one save of a run carries at most (SERIES-004.5). */
export const HASH_RUN_SAVE_BATCH = 250

/** A photo of the user without a hash of its current version, as the server lists it (ADR 0025). */
export interface MissingPicture {
	readonly fileId: number
	readonly etag: string
	readonly mtime: number
	readonly path: string
}

/** One page of missing hashes; `next` is the cursor of the following page, `null` after the last. */
export interface MissingPage {
	readonly pictures: MissingPicture[]
	readonly next: string | null
}

/** What a run needs from the server and the workers. */
export interface HashRunSeams {
	readonly listMissing: (path: string, after: string) => Promise<MissingPage>
	readonly hash: (picture: MissingPicture) => Promise<string>
	readonly save: (hashes: readonly StoredVisualHash[]) => Promise<number[]>
	readonly workers: number
	readonly saveBatch?: number
}

/** Where a run stands; `pausing` waits for the work in flight. */
export type HashRunStatus = 'idle' | 'running' | 'pausing' | 'paused' | 'done'

/** Why a run paused by itself: a save or a page of missing hashes failed. */
export type HashRunProblem = 'save' | 'page'

/**
 * A run that hashes every missing picture below a folder, page by page, in the seams' workers and
 * saves the hashes in batches; it pauses and resumes, and never tries a failed picture twice (SERIES-004).
 */
export function useHashRun(seams: HashRunSeams) {
	const saveBatch = seams.saveBatch ?? HASH_RUN_SAVE_BATCH
	const status = ref<HashRunStatus>('idle')
	const problem = ref<HashRunProblem | null>(null)
	const listed = ref(false)
	const states = shallowRef(new Map<number, { picture: MissingPicture, state: HashState }>())
	let run = 0
	let folder = ''
	let cursor = ''
	let queue: MissingPicture[] = []
	let unsaved: StoredVisualHash[] = []
	let hashing = 0
	let loading = false
	let saving = false

	const progress = computed(() => hashProgress([...states.value.values()].map((each) => each.state), problem.value === 'save'))
	const failedPaths = computed(() => [...states.value.values()].filter((each) => each.state === 'failed').map((each) => each.picture.path))

	/** Sets the state of one picture and lets the progress know. */
	function mark(fileId: number, state: HashState) {
		states.value.get(fileId)!.state = state
		triggerRef(states)
	}

	/** Hands out the next work the status allows, and settles the status once nothing is in flight. */
	function pump() {
		if (status.value === 'running') {
			if (!loading && !listed.value) {
				void loadPage(run)
			}
			while (hashing < seams.workers && queue.length > 0) {
				void hashOne(run, queue.shift()!)
			}
			if (unsaved.length >= saveBatch && !saving) {
				void save(run)
			}
		}
		const idle = hashing === 0 && !saving
		if (!idle || !['running', 'pausing'].includes(status.value)) {
			return
		}
		const finished = status.value === 'running' && !loading && listed.value && queue.length === 0
		if (unsaved.length > 0 && problem.value !== 'save' && (finished || status.value === 'pausing')) {
			void save(run)
		} else if (status.value === 'pausing') {
			status.value = 'paused'
		} else if (finished) {
			status.value = 'done'
		}
	}

	/** Asks for the next page of missing pictures and queues them; a failed page pauses the run. */
	async function loadPage(of: number) {
		loading = true
		try {
			const page = await seams.listMissing(folder, cursor)
			if (of !== run) {
				return
			}
			page.pictures.forEach((picture) => states.value.set(picture.fileId, { picture, state: 'pending' }))
			triggerRef(states)
			queue.push(...page.pictures)
			cursor = page.next ?? cursor
			listed.value = page.next === null
		} catch (error) {
			logger.warn('Could not load the photos without a visual hash', { error, folder, cursor })
			if (of === run) {
				problem.value = 'page'
				pause()
			}
		} finally {
			if (of === run) {
				loading = false
				pump()
			}
		}
	}

	/** Hashes one picture in a worker; a failure marks it failed for the rest of the run. */
	async function hashOne(of: number, picture: MissingPicture) {
		hashing++
		try {
			const hash = await seams.hash(picture)
			if (of === run) {
				unsaved.push({ fileId: picture.fileId, etag: picture.etag, hash })
				mark(picture.fileId, 'hashed')
			}
		} catch (error) {
			logger.warn('Could not hash the preview', { error, fileId: picture.fileId })
			if (of === run) {
				mark(picture.fileId, 'failed')
			}
		} finally {
			if (of === run) {
				hashing--
				pump()
			}
		}
	}

	/** Saves one batch; a failed save puts it back and pauses the run. */
	async function save(of: number) {
		saving = true
		const batch = unsaved.slice(0, saveBatch)
		unsaved = unsaved.slice(saveBatch)
		try {
			const saved = new Set(await seams.save(batch))
			if (of === run) {
				batch.filter((each) => !saved.has(each.fileId)).forEach((each) => mark(each.fileId, 'failed'))
			}
		} catch (error) {
			logger.warn('Could not save the visual hashes', { error, count: batch.length })
			if (of === run) {
				unsaved = [...batch, ...unsaved]
				problem.value = 'save'
				pause()
			}
		} finally {
			if (of === run) {
				saving = false
				pump()
			}
		}
	}

	/** Starts afresh with the missing hashes below `path`; work of an earlier run is dropped. */
	function start(path: string) {
		run++
		folder = path
		cursor = ''
		queue = []
		unsaved = []
		hashing = 0
		loading = false
		saving = false
		problem.value = null
		listed.value = false
		states.value = new Map()
		status.value = 'running'
		pump()
	}

	/** Hands out no further picture; the status turns `paused` once the hashes in flight are saved, a page load goes on. */
	function pause() {
		if (status.value === 'running') {
			status.value = 'pausing'
			pump()
		}
	}

	/** Goes on from where the run paused, and sends a failed save again. */
	function resume() {
		if (status.value === 'paused') {
			problem.value = null
			status.value = 'running'
			pump()
		}
	}

	return { status, problem, progress, listed, failedPaths, start, pause, resume }
}
