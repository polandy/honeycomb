// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ListingEntry } from './logic/listing.ts'

import { computed, ref, shallowRef, triggerRef, watch } from 'vue'
import { fireAndLog } from './fire-and-log.ts'
import { logger } from './logger.ts'
import { byFileId, saveQueue } from './logic/save-queue.ts'

/** How many computed values one save carries while computing goes on (ADR 0024). */
const SAVE_BATCH = 100

/** A file version: a new etag means new pixels. */
export const versionKey = (member: ListingEntry) => `${member.fileId}:${member.etag}`

/** Where a member's value stands: listed or computed, failed in this visit, or still to compute. */
export type ValueState = 'done' | 'failed' | 'pending'

/** A value the browser computes per file version and saves to the server: how, what it saves and how failures are logged. */
export interface BackgroundJob<Value, Row extends { readonly fileId: number }> {
	readonly compute: (member: ListingEntry) => Promise<Value>
	readonly save: (rows: readonly Row[]) => Promise<unknown>
	readonly wait: (seconds: number) => Promise<void>
	/** The row saved for a computed value. */
	readonly row: (member: ListingEntry, value: Value) => Row
	/** Whether the listing already delivered the member's value. */
	readonly listed: (member: ListingEntry) => boolean
	/** The log messages of a failed compute and a failed save. */
	readonly failures: { readonly compute: string, readonly save: string }
	/** Called after each computed value. */
	readonly computed?: () => void
}

/**
 * Computes the values `members` miss in the background, one at a time in their order once `ready`, and saves them in
 * batches; a limited save waits and is sent again, a failed one is logged and its values still count for this visit, and
 * a failed file version is not computed again in this visit (SERIES-003.12, .13, .27, SERIES-006.15–.18).
 */
export function useBackgroundValues<Value, Row extends { readonly fileId: number }>(job: BackgroundJob<Value, Row>, members: () => readonly ListingEntry[], ready: () => boolean = () => true) {
	const values = shallowRef(new Map<string, Value>())
	const failed = shallowRef(new Set<string>())
	const saveFailed = ref(false)
	let pending: ListingEntry[] = []
	const unsaved: Row[] = []
	let running = false
	let saving = false
	const queue = saveQueue<Row, number>(async (rows) => {
		await job.save(rows)
	}, { key: byFileId, wait: job.wait })

	/** Saves one batch at a time: full batches while computing goes on, the rest once it stops. */
	function save() {
		if (saving || !(unsaved.length >= SAVE_BATCH || (!running && unsaved.length > 0))) {
			return
		}
		saving = true
		const batch = unsaved.splice(0, SAVE_BATCH)
		fireAndLog(queue(batch).then((result) => {
			saveFailed.value = !result.ok
			if (!result.ok) {
				logger.warn(job.failures.save, { error: result.error, count: batch.length })
			}
			saving = false
			save()
		}), 'Could not save the background values')
	}

	/** Computes one member; a failure is logged and the file version is not computed again. */
	async function computeOne(member: ListingEntry) {
		try {
			const value = await job.compute(member)
			values.value.set(versionKey(member), value)
			triggerRef(values)
			unsaved.push(job.row(member, value))
			job.computed?.()
		} catch (error) {
			failed.value.add(versionKey(member))
			triggerRef(failed)
			logger.warn(job.failures.compute, { error, fileId: member.fileId })
		}
	}

	/** Computes the pending members in turn, so the tile loads keep their priority (SERIES-003.26), saving as it goes. */
	async function drain() {
		running = true
		for (let member = pending.shift(); member !== undefined; member = pending.shift()) {
			await computeOne(member)
			save()
		}
		running = false
		save()
	}

	/** Where the member's value stands. */
	function stateOf(member: ListingEntry): ValueState {
		const key = versionKey(member)
		if (job.listed(member) || values.value.has(key)) {
			return 'done'
		}
		return failed.value.has(key) ? 'failed' : 'pending'
	}

	const shown = computed(() => members())
	watch([shown, ready], ([list, isReady]) => {
		pending = isReady ? list.filter((member) => stateOf(member) === 'pending') : []
		if (!running && pending.length > 0) {
			fireAndLog(drain(), 'Could not drain the background values')
		}
	}, { immediate: true })

	return {
		stateOf,
		/** The value computed for the member's file version in this visit, if any. */
		computedOf: (member: ListingEntry): Value | undefined => values.value.get(versionKey(member)),
		/** The computed values by file version. */
		values,
		/** Whether the last save failed. */
		saveFailed,
	}
}
