// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { TileBadges, TilePill } from '../components/tile-badges.ts'
import type { ImmichSourceEntry } from '../logic/immich-asset.ts'
import type { AssetPill } from '../logic/immich-pills.ts'
import type { SourceEntry } from '../logic/listing.ts'
import type { Picture } from '../logic/pairing.ts'

import { n, t } from '@nextcloud/l10n'
import { imageMember } from '../logic/image-tiers.ts'
import { assetPills, clockDuration } from '../logic/immich-pills.ts'
import { formatNumber, PLAIN_TEXT } from '../shared/l10n.ts'

/** The pill as the tile shows it. */
function tilePill(pill: AssetPill): TilePill {
	switch (pill.kind) {
		case 'live':
			return { icon: 'live', text: t('honeycomb', 'LIVE') }
		case 'video':
			return { icon: 'play', text: pill.duration === null ? '' : clockDuration(pill.duration) }
		case 'stack':
			return { icon: 'stack', text: formatNumber(pill.size) }
	}
}

/** The asset's kind as the label says it, a video with its duration. */
function kindText(pills: readonly AssetPill[]): string {
	const kind = pills.find((pill) => pill.kind !== 'stack')
	if (kind?.kind === 'live') {
		return t('honeycomb', 'Motion photo')
	}
	if (kind?.kind === 'video') {
		return kind.duration === null ? t('honeycomb', 'Video') : t('honeycomb', 'Video, {duration}', { duration: clockDuration(kind.duration) }, undefined, PLAIN_TEXT)
	}
	return t('honeycomb', 'Photo')
}

/** An Immich tile's pills and label: its kind and its stack (IMMICH-002.37). */
export function immichBadges(picture: Picture<SourceEntry>): TileBadges {
	const pills = assetPills((imageMember(picture) as ImmichSourceEntry).asset)
	const stack = pills.find((pill) => pill.kind === 'stack')
	return {
		label: [kindText(pills), ...(stack === undefined ? [] : [n('honeycomb', 'Stack of {count} photo', 'Stack of {count} photos', stack.size, { count: formatNumber(stack.size) }, PLAIN_TEXT)])].join(', '),
		pills: pills.map(tilePill),
	}
}
