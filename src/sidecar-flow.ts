// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { SidecarFailure } from './logic/sidecar-sync.ts'
import type { XmpTime } from './logic/xmp/model.ts'
import type { SidecarApi } from './sidecar-sync.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, shallowRef } from 'vue'
import { useSidecarSync } from './sidecar-sync.ts'
import { notWrittenText } from './sidecar-text.ts'

/** The sidecar endpoints and the clock whose time a written sidecar records. */
export interface SidecarFlowApi extends SidecarApi {
	readonly now: () => XmpTime
}

/** The browser's time and UTC offset. */
export function browserNow(): XmpTime {
	const date = new Date()
	return { epochMs: date.getTime(), offsetMinutes: -date.getTimezoneOffset() }
}

/** Writing to sidecars as the user sees it: the toasts and the report (XMP-003.13). */
export function useSidecarFlow(api: SidecarFlowApi, toast: (message: string, action?: ToastAction | null) => void) {
	const report = shallowRef<SidecarFailure[] | null>(null)
	const open = computed(() => report.value !== null)
	const sync = useSidecarSync(api, api.now, (failed) => {
		toastFailed(notWrittenText(failed.map(({ reason }) => reason)), failed)
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

	/** Closes the report. */
	function close() {
		report.value = null
	}

	return { sync, report, open, close, toast, toastFailed }
}

/** The sidecar flow of the app. */
export type SidecarFlow = ReturnType<typeof useSidecarFlow>
