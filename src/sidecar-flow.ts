// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { XmpTime } from './logic/xmp/model.ts'
import type { SidecarApi } from './sidecar-sync.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
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

/** Writing to sidecars as the user sees it: the confirmation in shared folders, the toasts and the report with a retry (XMP-003.11–.13). */
export function useSidecarFlow(api: SidecarFlowApi, toast: (message: string, action?: ToastAction | null) => void) {
	const asking = shallowRef<Picture<ListingEntry>[] | null>(null)
	const report = shallowRef<SidecarFailure[] | null>(null)
	const open = computed(() => asking.value !== null || report.value !== null)
	const sync = useSidecarSync(api, api.now, (failed) => toast(notWrittenText(failed.length), {
		label: t('honeycomb', 'Details'),
		run: () => {
			report.value = failed
		},
	}))

	/** Asks before writing the pictures, the decided ones of shared folders. */
	function ask(pictures: Picture<ListingEntry>[]) {
		asking.value = pictures
	}

	/** Closes the question or the report. */
	function close() {
		asking.value = null
		report.value = null
	}

	/** Writes the pictures asked about and tells how many were written. */
	async function confirm(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const chosen = asking.value ?? []
		asking.value = null
		const { written, failed } = await sync.write(chosen, decisionOf)
		if (failed.length === 0) {
			toast(writtenText(written))
		}
	}

	/** Writes the failed sidecars once more. */
	function retry(decisionOf: (picture: Picture<ListingEntry>) => Decision) {
		const paths = new Map<Picture<ListingEntry>, Set<string>>()
		for (const { picture, path } of report.value ?? []) {
			paths.set(picture, (paths.get(picture) ?? new Set()).add(path))
		}
		report.value = null
		void sync.write([...paths.keys()], decisionOf, paths)
	}

	return { sync, asking, report, open, ask, close, confirm, retry }
}

/** The sidecar flow of the app. */
export type SidecarFlow = ReturnType<typeof useSidecarFlow>
