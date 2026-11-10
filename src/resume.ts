// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { Decision } from './logic/decision.ts'
import type { FolderSet } from './logic/folder-set.ts'
import type { ListingEntry } from './logic/listing.ts'
import type { Picture } from './logic/pairing.ts'
import type { ResumePosition } from './logic/resume-position.ts'
import type { ToastAction } from './toast.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, watch } from 'vue'
import { logger } from './logger.ts'
import { parsePositions, pictureHolding, positionFileId, positionOf, resumeIndex } from './logic/resume-position.ts'

/** The server seams of the resume position (ADR 0012). */
export interface ResumeApi {
	loadPositions(): Promise<unknown>
	savePosition(position: ResumePosition): Promise<void>
}

/** What the resume flow reads from the open cull and how it opens the loupe. */
export interface ResumeCull {
	readonly folderSet: () => FolderSet | null
	readonly pictures: () => readonly Picture<ListingEntry>[]
	readonly view: () => readonly Picture<ListingEntry>[]
	readonly progress: () => { decided: number, total: number }
	readonly decisionOf: (picture: Picture<ListingEntry>) => Decision
	/** The picture the loupe shows, null while it is closed. */
	readonly shown: () => Picture<ListingEntry> | null
	readonly openLoupe: (index: number) => void
}

/** Saves where the user stands in the open cull and offers to continue at the stored position (DECISIONS-002.7). */
export function useResume(api: ResumeApi, cull: ResumeCull, toast: (message: string, action: ToastAction) => void) {
	const fileId = ref<number | null>(null)
	let tracking = false
	let opening = 0
	let saving = false
	let waiting: ResumePosition | null = null
	let sent = ''

	/** Sends the position, or keeps it as the latest to send once the save in flight settles. */
	function save(position: ResumePosition) {
		if (saving) {
			waiting = position
			return
		}
		saving = true
		api.savePosition(position).catch((error: unknown) => logger.error('Could not save the resume position.', { error })).finally(() => {
			saving = false
			const next = waiting
			waiting = null
			if (next !== null) {
				save(next)
			}
		})
	}

	watch(() => {
		const shown = cull.shown()
		return [shown === null ? null : positionFileId(shown), cull.folderSet(), cull.progress().decided, cull.progress().total] as const
	}, ([shownId, folderSet, decided, total]) => {
		if (shownId !== null) {
			fileId.value = shownId
			tracking = true
		}
		const position = tracking && folderSet !== null && fileId.value !== null ? { folderSet, fileId: fileId.value, decided, total } : null
		if (position !== null && JSON.stringify(position) !== sent) {
			sent = JSON.stringify(position)
			save(position)
		}
	})

	/** Reads the stored position of the folder set just opened and offers it while the user has not moved on. */
	function offer() {
		const opened = ++opening
		fileId.value = null
		tracking = false
		sent = ''
		api.loadPositions().then((answer) => {
			const set = cull.folderSet()
			const position = set === null ? null : positionOf(parsePositions(answer), set)
			if (opened !== opening || tracking || position === null || pictureHolding(cull.pictures(), position.fileId) === null) {
				return
			}
			fileId.value = position.fileId
			toast(t('honeycomb', 'Continue where you left off'), { label: t('honeycomb', 'Resume'), run: resume })
		}).catch((error: unknown) => logger.error('Could not read the resume positions.', { error }))
	}

	/** Opens the loupe at the file of the folder set just opened from *Recent*, without the offer (DECISIONS-002.8). */
	function resumeAt(stored: number) {
		opening++
		tracking = false
		sent = ''
		fileId.value = pictureHolding(cull.pictures(), stored) === null ? null : stored
		resume()
	}

	const picture = computed(() => (fileId.value === null ? null : pictureHolding(cull.pictures(), fileId.value)))

	/** Opens the loupe at the stored picture (DECISIONS-002.9). */
	function resume() {
		const index = picture.value === null ? -1 : resumeIndex(cull.view(), picture.value, cull.decisionOf)
		if (index >= 0) {
			cull.openLoupe(index)
		}
	}

	return {
		offer,
		resume,
		resumeAt,
		/** The base name of the picture *Resume* opens, null when there is none. */
		resumeName: computed(() => picture.value?.baseName ?? null),
	}
}
