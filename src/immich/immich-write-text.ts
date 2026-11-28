// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { RatingChoice, RejectAs, SharedChoice, WriteConflict, WriteTally } from '../logic/immich-write-plan.ts'
import type { SendProgress } from '../logic/request-chunks.ts'

import { n, t } from '@nextcloud/l10n'
import { WRITE_BLOCK } from '../logic/immich-write-plan.ts'
import { writeBlockOf } from '../logic/immich-write-run.ts'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

const count = (value: number) => ({ count: formatNumber(value) })

/** The check's progress; `null` while the candidates load (IMMICH-004.25). */
export function checkingText(progress: SendProgress | null): string {
	if (progress === null) {
		return t('honeycomb', 'Loading your decisions…')
	}
	const { block, blocks } = writeBlockOf(progress)
	return n('honeycomb', 'Checking {count} photo with Immich · block {block} of {blocks}', 'Checking {count} photos with Immich · block {block} of {blocks}', progress.total, { ...count(progress.total), block: formatNumber(block), blocks: formatNumber(blocks) }, PLAIN_TEXT)
}

/** The write's progress (IMMICH-004.26). */
export function writingText(progress: SendProgress): string {
	const { block, blocks } = writeBlockOf(progress)
	return t('honeycomb', 'Writing block {block} of {blocks} · {done} of {total} photos', { block: formatNumber(block), blocks: formatNumber(blocks), done: formatNumber(progress.done), total: formatNumber(progress.total) }, undefined, PLAIN_TEXT)
}

/** *Written: N*, or *Written: N · Failed: M* (IMMICH-004.10). */
export function resultText({ written, failed }: WriteTally): string {
	const done = t('honeycomb', 'Written: {count}', count(written), undefined, PLAIN_TEXT)
	return failed === 0 ? done : `${done} · ${t('honeycomb', 'Failed: {count}', count(failed), undefined, PLAIN_TEXT)}`
}

/** The dialog's lead: how many photos change. */
export function changesText(assets: number): string {
	return n('honeycomb', '{count} photo changes.', '{count} photos change.', assets, count(assets), PLAIN_TEXT)
}

/** The write button, *Write N changes* (IMMICH-004.13). */
export function writeButtonText(assets: number): string {
	return n('honeycomb', 'Write {count} change', 'Write {count} changes', assets, count(assets), PLAIN_TEXT)
}

/** The footer's hint on the blocks and what is written (IMMICH-004.5). */
export function blocksHint(assets: number): string {
	const blocks = Math.max(1, Math.ceil(assets / WRITE_BLOCK))
	const sent = n('honeycomb', 'Sent in {count} block of up to {size} photos.', 'Sent in {count} blocks of up to {size} photos.', blocks, { ...count(blocks), size: formatNumber(WRITE_BLOCK) }, PLAIN_TEXT)
	return `${sent} ${t('honeycomb', 'Only Immich’s database changes; no file and no sidecar is written.')}`
}

/** The headings of the counts per kind of change (IMMICH-004.6). */
export const countHeadings = {
	rejects: (value: number) => n('honeycomb', '{count} rejected', '{count} rejected', value, count(value), PLAIN_TEXT),
	restores: (value: number) => n('honeycomb', '{count} no longer rejected', '{count} no longer rejected', value, count(value), PLAIN_TEXT),
	picks: (value: number) => n('honeycomb', '{count} picked', '{count} picked', value, count(value), PLAIN_TEXT),
	ratings: (value: number) => n('honeycomb', '{count} rating', '{count} ratings', value, count(value), PLAIN_TEXT),
	conflicts: (value: number) => n('honeycomb', '{count} to check before writing', '{count} to check before writing', value, count(value), PLAIN_TEXT),
}

/** The reject choices with their labels, the trash bin first (IMMICH-004.1, .3). */
export const REJECT_AS_CHOICES: readonly { readonly value: RejectAs, readonly label: string }[] = [
	{ value: 'trash', label: t('honeycomb', 'Move to Immich trash') },
	{ value: 'archive', label: t('honeycomb', 'Archive') },
	{ value: 'rating', label: t('honeycomb', 'Rating “rejected” only') },
]

/** What the chosen reject does in Immich. */
export function rejectAsText(rejectAs: RejectAs): string {
	switch (rejectAs) {
		case 'trash':
			return t('honeycomb', 'Immich moves them to its trash and empties it after 30 days. Until then you can restore them in the Immich app.')
		case 'archive':
			return t('honeycomb', 'They leave the Immich timeline and stay in the archive, with their files and albums.')
		case 'rating':
			return t('honeycomb', 'They stay in the timeline with Immich’s “rejected” rating (−1); you delete them in Immich later.')
	}
}

/** What the picks become on the connection (IMMICH-004.4). */
export function picksText(picksAsFavorites: boolean): string {
	return picksAsFavorites
		? t('honeycomb', 'They become favourites in Immich.')
		: t('honeycomb', 'Immich has no pick; on this connection picks stay in honeycomb.')
}

/** What a restored reject and a rating do in Immich. */
export const RESTORES_TEXT = t('honeycomb', 'Restored from the Immich trash or archive.')
export const RATINGS_TEXT = t('honeycomb', 'Set as the Immich rating. No stars in honeycomb clears the Immich rating.')

/** The choices of a rating changed in Immich, honeycomb's first (IMMICH-004.7). */
export const RATING_CHOICES: readonly { readonly value: RatingChoice, readonly label: string }[] = [
	{ value: 'honeycomb', label: t('honeycomb', 'Keep honeycomb’s') },
	{ value: 'immich', label: t('honeycomb', 'Keep Immich’s') },
]

/** The choices of a reject in a shared album, the trash bin first (IMMICH-004.8). */
export const SHARED_CHOICES: readonly { readonly value: SharedChoice, readonly label: string }[] = [
	{ value: 'trash', label: t('honeycomb', 'Trash anyway') },
	{ value: 'archive', label: t('honeycomb', 'Archive instead') },
	{ value: 'skip', label: t('honeycomb', 'Skip') },
]

/** A rating as stars, or *none*. */
function stars(rating: number | null): string {
	return rating !== null && rating > 0 ? '★'.repeat(rating) : t('honeycomb', 'none')
}

/** What a conflict says (IMMICH-004.7, .8, .9, .16). */
export function conflictText(conflict: WriteConflict): string {
	switch (conflict.kind) {
		case 'rating':
			return t('honeycomb', 'Rating changed in Immich since you decided: Immich {immich}, honeycomb {honeycomb}.', { immich: stars(conflict.immichRating), honeycomb: stars(conflict.honeycombRating) }, undefined, PLAIN_TEXT)
		case 'shared':
			return n('honeycomb', 'In the shared album “{album}”. The trash removes it there for {count} other person too.', 'In the shared album “{album}”. The trash removes it there for {count} other people too.', conflict.album.others, { album: conflict.album.name, ...count(conflict.album.others) }, PLAIN_TEXT)
		case 'trashed':
			return t('honeycomb', 'Already in the Immich trash. Counts as done; nothing is sent.')
		case 'stack':
			return t('honeycomb', 'Top of a stack of {count}. Only this photo goes; Immich makes the next one the top.', count(conflict.stackSize), undefined, PLAIN_TEXT)
	}
}

/** The skipped assets, as the user chose (IMMICH-004.8). */
export function skippedText(skipped: number): string {
	return t('honeycomb', 'Skipped, as you chose: {count}', count(skipped), undefined, PLAIN_TEXT)
}

/** What a failed asset says, never Immich's text (IMMICH-004.10). */
export const FAILED_TEXT = t('honeycomb', 'Immich refused this change. It keeps its decision in honeycomb and is offered again next time.')

/** What the dialog says while Immich does not answer (IMMICH-004.13). */
export const DOWN_TEXT = t('honeycomb', 'Immich does not answer at the moment. Your decisions stay in honeycomb; write them when Immich is back.')
