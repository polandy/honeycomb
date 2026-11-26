// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { ImmichConnection } from '../logic/immich-connections.ts'
import type { ImmichPosition, ImmichPositionSave } from '../logic/immich-position.ts'
import type { ToastAction } from '../shared/toast.ts'
import type { useImmichCull } from './immich-cull.ts'

import { t } from '@nextcloud/l10n'
import { computed, ref, shallowRef, watch } from 'vue'
import { parseImmichPositions, recentConnections, withImmichPosition } from '../logic/immich-position.ts'
import { logger } from '../shared/logger.ts'

/** Where the connections' positions are read and saved (ADR 0044). */
export interface ImmichPositionApi {
	readonly loadPositions: () => Promise<unknown>
	readonly savePosition: (position: ImmichPositionSave) => Promise<void>
}

/** What the resume of an Immich cull is given. */
export interface ImmichResumeContext {
	readonly api: ImmichPositionApi
	readonly cull: Pick<ReturnType<typeof useImmichCull>, 'connectionId' | 'list' | 'counts' | 'resumeFrom'>
	/** Shows the offer's toast and answers how to close it. */
	readonly toast: (message: string, action: ToastAction) => () => void
	readonly connections: () => readonly ImmichConnection[]
	readonly now: () => number
}

/** The connections' positions: saved as the loupe moves, offered on open, listed under *Recent* (IMMICH-003.14, IMMICH-003.15). */
export function useImmichResume(context: ImmichResumeContext) {
	const { api, cull } = context
	const positions = shallowRef<readonly ImmichPosition[]>([])
	const recent = computed(() => recentConnections(positions.value, context.connections()))
	// The loupe's index once a resume's first page arrived, until the screen takes it.
	const loupeAt = ref<number | null>(null)
	let shown: { assetId: string, takenAt: number } | null = null
	let sent = ''
	let opening = 0
	let pending: string | null = null
	let closeOffer = () => {}

	watch(() => cull.counts.value, save)
	// The resume's listing starts empty, so the first one started holds the asset (IMMICH-002.34).
	watch(() => cull.list.value, (list) => {
		if (pending !== null && list.started) {
			loupeAt.value = Math.max(0, list.entries.findIndex(({ assetId }) => assetId === pending))
			pending = null
		}
	})

	/** Saves the shown asset with the counts once both are known and differ from the last save. */
	function save() {
		const connectionId = cull.connectionId.value
		const counts = cull.counts.value
		if (shown === null || connectionId === null || counts === null) {
			return
		}
		const position = { connectionId, ...shown, decided: counts.decided, total: counts.total }
		if (JSON.stringify(position) === sent) {
			return
		}
		sent = JSON.stringify(position)
		api.savePosition(position).then(() => {
			positions.value = withImmichPosition(positions.value, { ...position, updatedAt: context.now() })
		}).catch((error: unknown) => logger.error('Could not save the Immich position.', { error }))
	}

	/** Keeps the asset the loupe shows as the connection's position and closes the offer. */
	function track(index: number) {
		const entry = cull.list.value.entries[index]
		if (entry === undefined) {
			return
		}
		dismiss()
		shown = { assetId: entry.assetId, takenAt: entry.takenAt }
		save()
	}

	/** Reads the stored position of the connection just opened and offers it while the user has not moved on. */
	function offer(connectionId: string) {
		const opened = ++opening
		shown = null
		sent = ''
		dismiss()
		api.loadPositions().then((answer) => {
			if (opened !== opening) {
				return
			}
			positions.value = parseImmichPositions(answer)
			const position = positions.value.find((each) => each.connectionId === connectionId)
			if (shown !== null || position === undefined) {
				return
			}
			closeOffer = context.toast(t('honeycomb', 'Continue where you left off'), { label: t('honeycomb', 'Resume'), run: () => resume(position) })
		}).catch((error: unknown) => logger.error('Could not read the Immich positions.', { error }))
	}

	/** Opens the listing at the position's asset; the loupe opens there once its page arrives. */
	function resume({ assetId, takenAt }: ImmichPosition) {
		pending = assetId
		cull.resumeFrom({ assetId, takenAt })
	}

	/** Closes the offer's toast, if it is still shown. */
	function dismiss() {
		closeOffer()
		closeOffer = () => {}
	}

	/** The loupe's index a resume asks for, once. */
	function takeLoupeAt(): number | null {
		const index = loupeAt.value
		loupeAt.value = null
		return index
	}

	/** Reads the positions again for *Recent* (IMMICH-003.15). */
	function refresh() {
		api.loadPositions().then((answer) => {
			positions.value = parseImmichPositions(answer)
		}).catch((error: unknown) => logger.error('Could not read the Immich positions.', { error }))
	}

	return { recent, loupeAt, offer, track, takeLoupeAt, refresh }
}
