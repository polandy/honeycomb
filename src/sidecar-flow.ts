// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { LegacyWrite } from './logic/legacy.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SendProgress } from './logic/request-chunks.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { XmpTime } from './logic/xmp/model.ts'
import type { SidecarApi } from './sidecar-sync.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { logger } from './logger.ts'
import { acknowledgedIds } from './logic/legacy.ts'
import { useSidecarSync } from './sidecar-sync.ts'
import { nothingToWriteText, notWrittenText, photosNotWrittenText, writtenText } from './sidecar-text.ts'

/** How many photos one part of a migration run writes, so its progress moves and its rows go early (XMP-007.11). */
export const MIGRATION_PART = 20

/** The sidecar endpoints and the clock whose time a written sidecar records. */
export interface SidecarFlowApi extends SidecarApi {
	readonly now: () => XmpTime
}

/** The browser's time and UTC offset. */
export function browserNow(): XmpTime {
	const date = new Date()
	return { epochMs: date.getTime(), offsetMinutes: -date.getTimezoneOffset() }
}

/** Writing to sidecars as the user sees it: the migration's confirmation, progress and result, the toasts and the report with a retry (XMP-003.13, XMP-007.5–.6, .11–.12). */
export function useSidecarFlow(api: SidecarFlowApi, toast: (message: string, action?: ToastAction | null) => void, acknowledge: (fileIds: readonly number[]) => Promise<unknown>) {
	const asking = shallowRef<readonly LegacyWrite[] | null>(null)
	const report = shallowRef<SidecarFailure[] | null>(null)
	const progress = shallowRef<SendProgress | null>(null)
	const open = computed(() => asking.value !== null || report.value !== null)
	// a migration run collects the failures of its passes for its one result
	let collected: SidecarFailure[] | null = null
	const sync = useSidecarSync(api, api.now, (failed) => {
		if (collected !== null) {
			collected.push(...failed)
		} else {
			toastFailed(notWrittenText(failed.map(({ reason }) => reason)), failed)
		}
	})

	/** Toasts the message with *Details*, which reports the failures. */
	function toastFailed(message: string, failed: SidecarFailure[]) {
		toast(message, {
			label: t('honeycomb', 'Details'),
			run: () => {
				report.value = failed
			},
		})
	}

	/** Asks before writing the legacy rows of the pictures to their sidecars. */
	function ask(writes: readonly LegacyWrite[]) {
		asking.value = writes
	}

	/** Closes the question or the report. */
	function close() {
		asking.value = null
		report.value = null
	}

	/** Writes the stored decisions and adds the stored tags part by part, acknowledges each picture saved in full, then tells the result. */
	async function confirm(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const chosen = asking.value ?? []
		if (chosen.length === 0) {
			asking.value = null
			toast(nothingToWriteText())
			return
		}
		const failed: SidecarFailure[] = []
		collected = failed
		let failedPictures = 0
		try {
			for (let done = 0; done < chosen.length; done += MIGRATION_PART) {
				progress.value = { done, total: chosen.length }
				const part = chosen.slice(done, done + MIGRATION_PART)
				const partFailed = await writePart(part, decisionOf)
				const failedSet = new Set(partFailed.map(({ picture }) => picture))
				failedPictures += part.filter(({ picture }) => failedSet.has(picture)).length
				const fileIds = acknowledgedIds(part, partFailed)
				if (fileIds.length > 0) {
					await acknowledge(fileIds)
				}
			}
		} catch (error) {
			logger.error('Could not write the stored decisions to sidecars', { error })
			toast(t('honeycomb', 'Could not write the sidecars; run it again later.'))
			return
		} finally {
			collected = null
			progress.value = null
			asking.value = null
		}
		if (failedPictures === 0) {
			toast(writtenText(chosen.length))
		} else {
			toastFailed(photosNotWrittenText(failedPictures, chosen.length, failed.map(({ reason }) => reason)), failed)
		}
	}

	/** Writes one part's stored decisions and tags in one pass; answers the failed sidecars. */
	async function writePart(part: readonly LegacyWrite[], decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const decided = part.filter((write) => write.decided).map(({ picture }) => picture)
		const written = decided.length > 0 ? [sync.write(decided, decisionOf)] : []
		const tagged = part.filter((write) => write.tags.length > 0).map(({ picture, tags }) => sync.writeTags([picture], { added: tags, removed: [] }))
		const results = await Promise.all([...written, ...tagged])
		return results.flatMap((result) => result.failed)
	}

	/** Writes the failed sidecars once more. */
	function retry(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const failed = report.value ?? []
		report.value = null
		void sync.retry(failed, decisionOf)
	}

	return { sync, asking, report, progress, open, ask, close, confirm, retry }
}

/** The sidecar flow of the app. */
export type SidecarFlow = ReturnType<typeof useSidecarFlow>
