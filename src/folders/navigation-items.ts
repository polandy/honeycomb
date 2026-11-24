// SPDX-FileCopyrightText: 2026 honeycomb contributors
// SPDX-License-Identifier: AGPL-3.0-or-later
import type { IconName } from '../components/AppIcon.vue'

import { t } from '@nextcloud/l10n'
import { generateUrl } from '@nextcloud/router'

/** The pages of their own next to the cull. */
export type Page = 'similarity' | 'statistics' | 'orphaned-sidecars'

/** One navigation entry that opens a page of its own. */
export interface NavigationItem {
	readonly page: Page
	readonly name: string
	readonly icon: IconName
	readonly href: string
}

/** The URL of a page of its own. */
export function pageUrl(page: Page): string {
	return generateUrl(`/apps/honeycomb/${page}`)
}

/** The navigation entries of the pages of their own, in their order (STATS-001.40, XMP-009.13). */
export function useNavigationItems(): readonly NavigationItem[] {
	return [
		{ page: 'similarity', name: t('honeycomb', 'Similarity'), icon: 'compare', href: pageUrl('similarity') },
		{ page: 'statistics', name: t('honeycomb', 'Statistics'), icon: 'chart', href: pageUrl('statistics') },
		{ page: 'orphaned-sidecars', name: t('honeycomb', 'Orphaned sidecars'), icon: 'trash', href: pageUrl('orphaned-sidecars') },
	]
}
