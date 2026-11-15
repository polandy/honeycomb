// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { LegacyWrite } from './logic/legacy.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { XmpTime } from './logic/xmp/model.ts'
import type { SidecarApi } from './sidecar-sync.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { acknowledgedIds } from './logic/legacy.ts'
import { useSidecarSync } from './sidecar-sync.ts'
import { notWrittenText, writtenText } from './sidecar-text.ts'

/** The sidecar endpoints and the clock whose time a written sidecar records. */
export interface SidecarFlowApi extends SidecarApi {
	readonly now: () => XmpTime
}

/** The browser's time and UTC offset. */
export function browserNow(): XmpTime {
	const date = new Date()
	return { epochMs: date.getTime(), offsetMinutes: -date.getTimezoneOffset() }
}

/** Writing to sidecars as the user sees it: the migration's confirmation, the toasts and the report with a retry (XMP-003.13, XMP-007.5–.6); `createsNew` as in `useSidecarSync`. */
export function useSidecarFlow(api: SidecarFlowApi, toast: (message: string, action?: ToastAction | null) => void, createsNew: () => boolean, acknowledge: (fileIds: readonly number[]) => Promise<void>) {
	const asking = shallowRef<readonly LegacyWrite[] | null>(null)
	const report = shallowRef<SidecarFailure[] | null>(null)
	const open = computed(() => asking.value !== null || report.value !== null)
	const sync = useSidecarSync(api, api.now, (failed) => toast(notWrittenText(failed.length), {
		label: t('honeycomb', 'Details'),
		run: () => {
			report.value = failed
		},
	}), createsNew)

	/** Asks before writing the legacy rows of the pictures to their sidecars. */
	function ask(writes: readonly LegacyWrite[]) {
		asking.value = writes
	}

	/** Closes the question or the report. */
	function close() {
		asking.value = null
		report.value = null
	}

	/** Writes the stored decisions and adds the stored tags in one pass, then acknowledges each picture saved in full. */
	async function confirm(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const chosen = asking.value ?? []
		asking.value = null
		const decided = chosen.filter((write) => write.decided).map(({ picture }) => picture)
		const written = decided.length > 0 ? [sync.write(decided, decisionOf)] : []
		const tagged = chosen.filter((write) => write.tags.length > 0).map(({ picture, tags }) => sync.writeTags([picture], { added: tags, removed: [] }))
		const results = await Promise.all([...written, ...tagged])
		const failed = results.flatMap((result) => result.failed)
		if (failed.length === 0) {
			toast(writtenText(chosen.length))
		}
		const fileIds = acknowledgedIds(chosen, failed)
		if (fileIds.length > 0) {
			await acknowledge(fileIds)
		}
	}

	/** Writes the failed sidecars once more. */
	function retry(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const failed = report.value ?? []
		report.value = null
		void sync.retry(failed, decisionOf)
	}

	return { sync, asking, report, open, ask, close, confirm, retry }
}

/** The sidecar flow of the app. */
export type SidecarFlow = ReturnType<typeof useSidecarFlow>
